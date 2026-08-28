import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService, UnitOfWork, hasAnyRole, type Principal } from '../shared/index.js'
import { AUDIT_MODE_ROLES, searchableStatuses } from './document-rules.js'
import {
  DocumentSearchRepository,
  type SearchFilters,
  type SearchHit,
} from './document-search.repository.js'

export interface SearchResponse {
  readonly results: readonly SearchHit[]
  readonly facets: { documentType: unknown; processArea: unknown }
  /** FR-C-012: present only when nothing matched. */
  readonly suggestions?: readonly { document_id: string; title: string; process_area: string }[]
  readonly empty_guidance?: string
}

/**
 * FR-C-009 s.d. FR-C-012 · the search surface.
 *
 * The service's job is small on purpose: decide which statuses the caller may
 * search over, hand the query to the repository (where the entitlement filter
 * is structural), and turn an empty result into something actionable. It never
 * filters results itself -- a second filter in the service would be a second
 * place to get FR-C-010 wrong.
 */
@Injectable()
export class DocumentSearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: DocumentSearchRepository,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * FR-C-010 aturan 3 · audit mode.
   *
   * Only AUDITOR_INT, AUDIT_LEAD and COMPLIANCE may turn it on, and turning it
   * on is written to the audit trail. It is passed in explicitly rather than
   * inferred from the caller's roles: an auditor doing ordinary work should see
   * the same corpus everyone else does, so that what they see matches what the
   * business sees unless they deliberately chose otherwise.
   */
  async search(
    principal: Principal,
    params: {
      query: string
      filters: SearchFilters
      auditMode: boolean
      limit: number
    },
  ): Promise<SearchResponse> {
    if (params.auditMode && !hasAnyRole(principal, ...AUDIT_MODE_ROLES)) {
      throw new ForbiddenException('Mode audit hanya untuk auditor internal dan kepatuhan.')
    }
    if (params.auditMode) {
      await this.uow.write(async (_tx, audit) => {
        await audit.record({
          action: 'AKTIFKAN_MODE_AUDIT_DOKUMEN',
          objectType: 'DOCUMENT_SEARCH',
          objectId: principal.userId,
          after: { query: params.query },
        })
      })
    }

    const statuses = searchableStatuses(params.auditMode)
    const orgUnitId = await this.orgUnitOf(principal)

    const [results, facets] = await Promise.all([
      this.repo.search({
        userId: principal.userId,
        orgUnitId,
        query: params.query,
        statuses,
        filters: params.filters,
        limit: params.limit,
      }),
      this.repo.facets({ userId: principal.userId, statuses }),
    ])

    if (results.length > 0) return { results, facets }

    // FR-C-012 · a miss is a signal about the corpus, not a dead end.
    const suggestions = await this.repo.suggestions({
      userId: principal.userId,
      query: params.query,
      statuses,
      limit: 5,
    })
    await this.repo.recordMiss({
      userId: principal.userId,
      query: params.query,
      filters: params.filters,
    })

    return {
      results: [],
      facets,
      suggestions,
      empty_guidance:
        suggestions.length > 0
          ? 'Tidak ada hasil persis. Mungkin yang Anda cari salah satu dokumen berikut.'
          : 'Tidak ada hasil. Coba istilah lain, longgarkan penyaring, atau ajukan pertanyaan ke unit pemilik bidang terkait.',
    }
  }

  /**
   * The document detail read. Entitlement is checked with the same database
   * predicate the search uses, and a denial is reported as 404, not 403 --
   * kode aturan #3: a 403 confirms the document exists, which for a Rahasia
   * document is itself the disclosure.
   */
  async detail(principal: Principal, documentId: string) {
    const allowed = await this.repo.canAccess(principal.userId, documentId)
    if (!allowed) throw new NotFoundException('Dokumen tidak ditemukan.')

    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        documentNo: true,
        title: true,
        documentType: true,
        classification: true,
        processArea: true,
        tags: true,
        summary: true,
        status: true,
        nextReviewDate: true,
        ownerEmployee: { select: { fullName: true, jobTitle: true } },
        ownerOrgUnit: { select: { code: true, name: true } },
        versions: {
          select: {
            id: true,
            versionMajor: true,
            versionMinor: true,
            status: true,
            changeSummary: true,
            effectiveFrom: true,
            effectiveUntil: true,
            approvedAt: true,
          },
          orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
        },
        controlLinks: {
          select: { id: true, note: true, control: { select: { id: true, code: true, title: true } } },
        },
      },
    })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan.')

    // FR-X-008 aturan 2: opening a Terbatas/Rahasia document is an audited
    // read. The audit entry is the control; the read itself is unremarkable.
    if (doc.classification === 'TERBATAS' || doc.classification === 'RAHASIA') {
      await this.uow.write(async (_tx, audit) => {
        await audit.record({
          action: 'BUKA_DOKUMEN',
          objectType: 'DOCUMENT',
          objectId: documentId,
          after: { classification: doc.classification },
        })
      })
    }

    return doc
  }

  /** FR-C-007 aturan 3 · which version was in force on a given date. */
  async versionInForceOn(principal: Principal, documentId: string, on: Date) {
    const version = await this.repo.versionInForceOn({
      userId: principal.userId,
      documentId,
      on,
    })
    if (!version) {
      throw new NotFoundException(
        'Tidak ada versi yang berlaku pada tanggal itu, atau dokumen tidak dapat diakses.',
      )
    }
    return version
  }

  private async orgUnitOf(principal: Principal): Promise<string | null> {
    if (!principal.employeeId) return null
    const employee = await this.prisma.employee.findUnique({
      where: { id: principal.employeeId },
      select: { orgUnitId: true },
    })
    return employee?.orgUnitId ?? null
  }
}
