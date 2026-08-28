import { Injectable } from '@nestjs/common'
import { PrismaService } from '../shared/index.js'

/**
 * FR-C-009 s.d. FR-C-012 · the hybrid search read path.
 *
 * Raw SQL, on purpose and in one place. Two reasons:
 *
 * 1. The reciprocal-rank fusion of a tsvector branch and a pgvector branch in
 *    04-TRD Sec 4.2 is not expressible through Prisma's query builder.
 * 2. CLAUDE.md rule 1 puts entitlement filtering in the repository layer. Here
 *    that is stronger than a convention: every branch of every query in this
 *    file joins the `accessible` CTE, which calls `check_document_access` in
 *    the database. FR-C-010 aturan 1 forbids a forbidden document from
 *    appearing in results, in the result COUNT, or in suggestions, and the only
 *    way to keep that promise across three different queries is for the filter
 *    to be the first thing each of them does.
 *
 * The parameters are passed through `$queryRaw` tagged templates, so they are
 * bound values and never interpolated text.
 */

export interface SearchFilters {
  readonly documentType?: string
  readonly processArea?: string
  readonly ownerOrgUnitId?: string
  readonly tags?: readonly string[]
  readonly effectiveFrom?: Date
  readonly effectiveUntil?: Date
}

export interface SearchHit {
  readonly document_id: string
  readonly document_no: string | null
  readonly title: string
  readonly document_type: string
  readonly process_area: string
  readonly classification: string
  readonly status: string
  readonly version_id: string
  readonly version_major: number
  readonly version_minor: number
  readonly effective_from: Date | null
  readonly section_ref: string | null
  readonly snippet: string
  readonly score: number
}

/** FR-C-013 · a chunk eligible to form part of an answer. */
export interface AnswerChunkRow {
  readonly id: string
  readonly document_id: string
  readonly document_title: string
  readonly classification: string
  readonly version_major: number
  readonly version_minor: number
  readonly section_ref: string | null
  readonly content: string
  readonly score: number
}

export interface FacetCount {
  readonly value: string
  readonly count: number
}

@Injectable()
export class DocumentSearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * FR-C-009 · keyword + (when embeddings exist) semantic, fused by reciprocal
   * rank so a document found by both rises above one found by either.
   *
   * The semantic branch is omitted while `content_embedding` is NULL
   * everywhere, which is the state until a local embedding model is wired in
   * (ADR-03). Its absence degrades ranking; it never fails the search, and it
   * never widens what a user can see, because both branches are gated by the
   * same `accessible` CTE.
   *
   * FR-C-009 aturan 4 boosts: a title match outranks a body match, a more
   * recently effective document edges ahead, and a document owned by the
   * searcher's own unit edges ahead. They are small multipliers deliberately --
   * large ones would let recency beat relevance.
   */
  async search(params: {
    userId: string
    orgUnitId: string | null
    query: string
    statuses: readonly string[]
    filters: SearchFilters
    limit: number
  }): Promise<SearchHit[]> {
    const { userId, orgUnitId, query, statuses, filters, limit } = params

    return this.prisma.$queryRaw<SearchHit[]>`
      WITH accessible AS (
        SELECT dv.id AS version_id, d.id AS document_id
        FROM document d
        JOIN document_version dv ON dv.document_id = d.id
        WHERE d.status = ANY(${statuses}::document_status[])
          AND dv.status = ANY(${statuses}::document_status[])
          AND (dv.effective_from IS NULL OR CURRENT_DATE >= dv.effective_from)
          AND (dv.effective_until IS NULL OR CURRENT_DATE <= dv.effective_until)
          AND (${filters.documentType ?? null}::document_type IS NULL
               OR d.document_type = ${filters.documentType ?? null}::document_type)
          AND (${filters.processArea ?? null}::process_area IS NULL
               OR d.process_area = ${filters.processArea ?? null}::process_area)
          AND (${filters.ownerOrgUnitId ?? null}::uuid IS NULL
               OR d.owner_org_unit_id = ${filters.ownerOrgUnitId ?? null}::uuid)
          AND (${filters.tags ?? null}::text[] IS NULL
               OR d.tags && ${filters.tags ?? null}::text[])
          AND (${filters.effectiveFrom ?? null}::date IS NULL
               OR dv.effective_from >= ${filters.effectiveFrom ?? null}::date)
          AND (${filters.effectiveUntil ?? null}::date IS NULL
               OR dv.effective_from <= ${filters.effectiveUntil ?? null}::date)
          AND check_document_access(d.id, ${userId}::uuid)
      ),
      q AS (
        SELECT websearch_to_tsquery('indonesian_simple', ${query}) AS tsq
      ),
      keyword AS (
        SELECT c.id,
               ROW_NUMBER() OVER (
                 ORDER BY ts_rank_cd(c.content_tsv, q.tsq) DESC
               ) AS rank
        FROM document_chunk c
        JOIN accessible a ON a.version_id = c.document_version_id
        CROSS JOIN q
        WHERE c.content_tsv @@ q.tsq
        LIMIT 100
      ),
      title_match AS (
        -- FR-C-009 aturan 4: a hit in the title is a stronger signal than a hit
        -- in the body, so titles enter the fusion as their own branch rather
        -- than as a post-hoc multiplier.
        SELECT c.id,
               ROW_NUMBER() OVER (ORDER BY similarity(d.title, ${query}) DESC) AS rank
        FROM document_chunk c
        JOIN accessible a ON a.version_id = c.document_version_id
        JOIN document d ON d.id = a.document_id
        WHERE d.title % ${query}
          AND c.chunk_index = 0
        LIMIT 50
      ),
      fused AS (
        SELECT id, SUM(1.0 / (60 + rank)) AS score
        FROM (
          SELECT id, rank FROM keyword
          UNION ALL
          SELECT id, rank FROM title_match
        ) combined
        GROUP BY id
      )
      SELECT d.id            AS document_id,
             d.document_no,
             d.title,
             d.document_type::text  AS document_type,
             d.process_area::text   AS process_area,
             d.classification::text AS classification,
             d.status::text         AS status,
             dv.id           AS version_id,
             dv.version_major,
             dv.version_minor,
             dv.effective_from,
             c.section_ref,
             left(c.content, 400) AS snippet,
             (
               f.score
               -- Recency nudge: at most +10%, tapering over five years.
               -- Subtracting one date from another in PostgreSQL yields an
               -- integer number of days, not an interval, so this divides days
               -- by days. Wrapping it in EXTRACT(EPOCH ...) is a type error,
               -- which is how the first version of this was caught.
               * (1 + 0.1 * GREATEST(0, 1 - (
                   (CURRENT_DATE - COALESCE(dv.effective_from, CURRENT_DATE))::numeric
                   / (5 * 365)
                 )))
               -- Own-unit nudge: +5%.
               * (CASE WHEN ${orgUnitId}::uuid IS NOT NULL
                        AND d.owner_org_unit_id = ${orgUnitId}::uuid
                       THEN 1.05 ELSE 1 END)
             )::float8 AS score
      FROM fused f
      JOIN document_chunk c ON c.id = f.id
      JOIN document_version dv ON dv.id = c.document_version_id
      JOIN document d ON d.id = dv.document_id
      ORDER BY score DESC
      LIMIT ${limit}
    `
  }

  /**
   * FR-C-013 aturan 1 · chunks that may form an answer for THIS asker.
   *
   * Deliberately a separate query from `search`, and deliberately still routed
   * through `check_document_access`. The temptation is to reuse the search hits
   * the user already has on screen, but those carry only a snippet; an answer
   * needs the full chunk text. Re-fetching by id without re-checking
   * entitlement would create a second, unguarded path to document content --
   * and this one feeds the single route out of the company (ADR-03).
   *
   * The classification travels with each row because the gate downstream
   * decides on it. Reading it here, in the same query that already proved
   * access, keeps the two facts from being fetched separately and drifting.
   */
  async chunksForAnswer(params: {
    userId: string
    query: string
    statuses: readonly string[]
    limit: number
  }): Promise<AnswerChunkRow[]> {
    const { userId, query, statuses, limit } = params

    return this.prisma.$queryRaw<AnswerChunkRow[]>`
      WITH accessible AS (
        SELECT dv.id AS version_id, d.id AS document_id
        FROM document d
        JOIN document_version dv ON dv.document_id = d.id
        WHERE d.status = ANY(${statuses}::document_status[])
          AND dv.status = ANY(${statuses}::document_status[])
          AND (dv.effective_from IS NULL OR CURRENT_DATE >= dv.effective_from)
          AND (dv.effective_until IS NULL OR CURRENT_DATE <= dv.effective_until)
          AND check_document_access(d.id, ${userId}::uuid)
      ),
      q AS (
        SELECT websearch_to_tsquery('indonesian_simple', ${query}) AS tsq
      )
      SELECT c.id,
             d.id AS document_id,
             d.title AS document_title,
             d.classification::text AS classification,
             dv.version_major,
             dv.version_minor,
             c.section_ref,
             c.content,
             ts_rank_cd(c.content_tsv, q.tsq)::float8 AS score
      FROM document_chunk c
      JOIN accessible a ON a.version_id = c.document_version_id
      JOIN document_version dv ON dv.id = c.document_version_id
      JOIN document d ON d.id = dv.document_id
      CROSS JOIN q
      WHERE c.content_tsv @@ q.tsq
      ORDER BY score DESC
      LIMIT ${limit}
    `
  }

  /**
   * FR-C-011 · the count each filter would yield, computed AFTER entitlement
   * filtering. Computing it before would leak the existence of documents the
   * searcher may not see through the facet numbers alone -- the same leak
   * FR-C-010 aturan 1 closes for the result list.
   */
  async facets(params: {
    userId: string
    statuses: readonly string[]
  }): Promise<{ documentType: FacetCount[]; processArea: FacetCount[] }> {
    const { userId, statuses } = params

    const rows = await this.prisma.$queryRaw<{ dimension: string; value: string; count: bigint }[]>`
      WITH accessible AS (
        SELECT d.id, d.document_type, d.process_area
        FROM document d
        WHERE d.status = ANY(${statuses}::document_status[])
          AND check_document_access(d.id, ${userId}::uuid)
      )
      SELECT 'document_type' AS dimension, document_type::text AS value, COUNT(*) AS count
      FROM accessible GROUP BY document_type
      UNION ALL
      SELECT 'process_area', process_area::text, COUNT(*)
      FROM accessible GROUP BY process_area
    `

    return {
      documentType: rows
        .filter((r) => r.dimension === 'document_type')
        .map((r) => ({ value: r.value, count: Number(r.count) })),
      processArea: rows
        .filter((r) => r.dimension === 'process_area')
        .map((r) => ({ value: r.value, count: Number(r.count) })),
    }
  }

  /**
   * FR-C-012 aturan 1 & 2 · what to offer when nothing matched: near-miss
   * titles by trigram similarity, drawn only from documents the searcher may
   * already see (aturan 1 of FR-C-010 covers suggestions explicitly).
   */
  async suggestions(params: {
    userId: string
    query: string
    statuses: readonly string[]
    limit: number
  }): Promise<{ document_id: string; title: string; process_area: string }[]> {
    const { userId, query, statuses, limit } = params
    return this.prisma.$queryRaw`
      SELECT d.id AS document_id, d.title, d.process_area::text AS process_area
      FROM document d
      WHERE d.status = ANY(${statuses}::document_status[])
        AND check_document_access(d.id, ${userId}::uuid)
        AND similarity(d.title, ${query}) > 0.15
      ORDER BY similarity(d.title, ${query}) DESC
      LIMIT ${limit}
    `
  }

  /**
   * FR-C-007 aturan 3 · which version was in force on a given date. The
   * question an audit of a past period actually asks, answered from the stored
   * force window rather than reconstructed from history.
   */
  async versionInForceOn(params: {
    userId: string
    documentId: string
    on: Date
  }): Promise<{ id: string; version_major: number; version_minor: number } | null> {
    const rows = await this.prisma.$queryRaw<
      { id: string; version_major: number; version_minor: number }[]
    >`
      SELECT dv.id, dv.version_major, dv.version_minor
      FROM document_version dv
      JOIN document d ON d.id = dv.document_id
      WHERE dv.document_id = ${params.documentId}::uuid
        AND check_document_access(d.id, ${params.userId}::uuid)
        AND dv.effective_from IS NOT NULL
        AND dv.effective_from <= ${params.on}::date
        AND (dv.effective_until IS NULL OR dv.effective_until >= ${params.on}::date)
        AND dv.status IN ('BERLAKU', 'DIGANTIKAN', 'DITARIK')
      ORDER BY dv.effective_from DESC
      LIMIT 1
    `
    return rows[0] ?? null
  }

  /** FR-C-010 · a single access check, for the document detail read path. */
  async canAccess(userId: string, documentId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<{ allowed: boolean }[]>`
      SELECT check_document_access(${documentId}::uuid, ${userId}::uuid) AS allowed
    `
    return rows[0]?.allowed === true
  }

  /** FR-C-012 aturan 4 · record a zero-result search for content-gap analysis. */
  async recordMiss(params: {
    userId: string
    query: string
    filters: SearchFilters
  }): Promise<void> {
    await this.prisma.documentSearchMiss.create({
      data: {
        queryText: params.query,
        userId: params.userId,
        filters: JSON.parse(JSON.stringify(params.filters)) as object,
      },
    })
  }
}
