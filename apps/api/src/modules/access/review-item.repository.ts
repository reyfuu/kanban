import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma, ReviewItemStatus } from '@prisma/client'
import {
  applicationScope,
  orgUnitScope,
  type Principal,
  PrismaService,
  type TransactionClient,
} from '../shared/index.js'
import type { ItemRiskProfile } from './review-rules.js'

/**
 * One review item with everything FR-B-011 requires the reviewer to see.
 *
 * Assembled here rather than in the controller because it spans three sources:
 * the review_item row, the snapshot_line it points at (which carries no foreign
 * key -- see below), and the entitlement catalogue.
 */
export interface ReviewItemView {
  id: string
  campaignId: string
  campaignName: string
  campaignDueDate: Date
  status: ReviewItemStatus
  reviewerId: string
  layerNo: number
  accountId: string
  employee: { id: string; fullName: string; employeeNumber: string; jobTitle: string | null; orgUnitCode: string; orgUnitName: string } | null
  application: { id: string; code: string; name: string }
  entitlement: {
    id: string
    code: string
    displayName: string
    businessDescription: string | null
    riskLevel: ItemRiskProfile['riskLevel']
    isPrivileged: boolean
  }
  context: { grantedAt: Date | null; grantedBy: string | null; lastAccessAt: Date | null }
  profile: ItemRiskProfile
  sodConflicts: { ruleCode: string; ruleName: string; riskDescription: string }[]
  anomalies: { code: string; severity: ItemRiskProfile['riskLevel'] }[]
  decision: {
    decision: string
    reason: string | null
    decidedByName: string
    decidedAt: Date
    bulkApplied: boolean
    onBehalfOfName: string | null
  } | null
  isSignedOff: boolean
  signedOffAt: Date | null
}

/**
 * Repository for review items (FR-B-011).
 *
 * CLAUDE.md rule 1: scope filtering happens HERE, not in a controller. Every
 * method that returns items takes a Principal and narrows to what that
 * principal may see, so a second controller, a report exporter or a background
 * job reaching the same method inherits the filter rather than having to
 * remember it.
 *
 * There is a second, less obvious job. `review_item.snapshot_line_id` has no
 * database foreign key -- snapshot_line is range-partitioned on captured_at and
 * its primary key is the composite (id, captured_at), which PostgreSQL cannot
 * be referenced by a single column (ADR-07, migration Sec 7). PostgreSQL will
 * therefore happily store a review_item pointing at a snapshot line that does
 * not exist. Every read below joins the line explicitly and every write checks
 * it exists first. That check is not defensive programming; it is the
 * substitute for the constraint the database cannot give us.
 */
@Injectable()
export class ReviewItemRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The ids of review items this principal may see, already scope-filtered.
   *
   * Raw SQL, and not by preference. The scope rule is about the item's OWN
   * application and the reviewed employee's OWN org unit -- both of which are
   * reachable only through snapshot_line, which carries no foreign key from
   * review_item and therefore no Prisma relation to traverse (ADR-07, migration
   * Sec 7). Written as a Prisma filter, the nearest expressible predicate is
   * about the CAMPAIGN ("this campaign includes at least one application you
   * may see"), and that is a different, far weaker statement: it admits every
   * item of every campaign that happens to touch one in-scope application.
   *
   * That is exactly the leak this method exists to close, so the join is done
   * where it can be stated correctly rather than approximated where it cannot.
   *
   * Both dimensions are AND-ed when both are present: scope narrows, it never
   * widens, so holding two restricted dimensions must not let one rescue rows
   * the other excluded.
   */
  private async scopedItemIds(
    principal: Principal,
    filter: {
      campaignId?: string
      status?: ReviewItemStatus
      reviewerIds?: readonly string[]
      itemIds?: readonly string[]
      take?: number
    },
  ): Promise<string[]> {
    const apps = applicationScope(principal)
    const units = orgUnitScope(principal)

    // An empty array means "no restriction on this dimension"; the SQL checks
    // cardinality = 0 for that. A dimension that IS restricted but narrowed to
    // nothing arrives here as an empty ScopeFilter.values, which must match no
    // rows -- so it is turned into a sentinel that cannot equal any real value
    // rather than into the unrestricted case.
    const appIds = apps.isUnrestricted ? [] : ([...apps.values!] as string[])
    const unitCodes = units.isUnrestricted ? [] : ([...units.values!] as string[])
    const appsNarrowedToNothing = !apps.isUnrestricted && appIds.length === 0
    const unitsNarrowedToNothing = !units.isUnrestricted && unitCodes.length === 0
    if (appsNarrowedToNothing || unitsNarrowedToNothing) return []

    const reviewerIds = filter.reviewerIds ? [...filter.reviewerIds] : []
    const itemIds = filter.itemIds ? [...filter.itemIds] : []

    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT ri.id::text AS id
      FROM public.review_item ri
      JOIN public.snapshot_line sl       ON sl.id = ri.snapshot_line_id
      JOIN public.entitlement_catalog ec ON ec.id = sl.entitlement_id
      JOIN public.application a          ON a.id = ec.application_id
      LEFT JOIN public.employee e           ON e.id = sl.employee_id
      LEFT JOIN public.organization_unit ou ON ou.id = e.org_unit_id
      WHERE (cardinality(${appIds}::uuid[]) = 0 OR a.id = ANY(${appIds}::uuid[]))
        AND (
          cardinality(${unitCodes}::text[]) = 0
          OR ou.code = ANY(${unitCodes}::text[])
          -- An item assigned to this principal is always theirs to see. A
          -- campaign legitimately routes items outside a reviewer's own unit --
          -- an application owner reviews by application, not by org chart --
          -- and hiding those would leave items permanently undecidable.
          OR ri.reviewer_id = ${principal.userId}::uuid
        )
        AND (${filter.campaignId ?? null}::uuid IS NULL OR ri.campaign_id = ${filter.campaignId ?? null}::uuid)
        AND (${filter.status ?? null}::text IS NULL OR ri.status::text = ${filter.status ?? null}::text)
        AND (cardinality(${reviewerIds}::uuid[]) = 0 OR ri.reviewer_id = ANY(${reviewerIds}::uuid[]))
        AND (cardinality(${itemIds}::uuid[]) = 0 OR ri.id = ANY(${itemIds}::uuid[]))
      ORDER BY ri.status ASC, ri.created_at ASC
      LIMIT ${filter.take ?? 1000}
    `

    return rows.map((r) => r.id)
  }

  /** The reviewer plus anyone who delegated to them (FR-X-007). */
  private reviewerIdsFor(principal: Principal): string[] {
    return [principal.userId, ...principal.delegatedFrom.map((d) => d.userId)]
  }

  private static include = {
    campaign: { select: { id: true, name: true, dueDate: true } },
    decision: {
      include: {
        decidedByUser: { include: { employee: { select: { fullName: true } } } },
        onBehalfOfUser: { include: { employee: { select: { fullName: true } } } },
      },
    },
  } satisfies Prisma.ReviewItemInclude

  /** FR-B-011 · `GET /my/review-items`. */
  async findForReviewer(
    principal: Principal,
    filter: { campaignId?: string; status?: ReviewItemStatus; take: number },
  ): Promise<ReviewItemView[]> {
    const ids = await this.scopedItemIds(principal, {
      ...filter,
      // A delegate reviews on behalf of the delegator (FR-X-007), so their
      // worklist includes items assigned to whoever delegated to them.
      reviewerIds: this.reviewerIdsFor(principal),
    })
    return this.loadByIds(ids)
  }

  /** FR-B-016 · `GET /campaigns/{id}/items`, for campaign owners and auditors. */
  async findForCampaign(
    principal: Principal,
    campaignId: string,
    filter: { reviewerId?: string; status?: ReviewItemStatus; take: number },
  ): Promise<ReviewItemView[]> {
    const ids = await this.scopedItemIds(principal, {
      campaignId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.reviewerId ? { reviewerIds: [filter.reviewerId] } : {}),
      take: filter.take,
    })
    return this.loadByIds(ids)
  }

  /**
   * A single item, already scope-checked.
   *
   * Returns null rather than throwing so the caller decides the response. Note
   * that "out of scope" and "does not exist" collapse into the same null on
   * purpose: 07-API-CONTRACT Sec 1.6 and CLAUDE.md rule 3 want 404 rather than
   * 403 for objects whose existence is itself information, and which employee
   * holds which entitlement is exactly that.
   */
  async findOne(principal: Principal, id: string): Promise<ReviewItemView | null> {
    const ids = await this.scopedItemIds(principal, { itemIds: [id], take: 1 })
    const [view] = await this.loadByIds(ids)
    return view ?? null
  }

  /** Same as findOne but raises the 404 the contract specifies. */
  async findOneOrFail(principal: Principal, id: string): Promise<ReviewItemView> {
    const item = await this.findOne(principal, id)
    if (!item) throw new NotFoundException('Item review tidak ditemukan.')
    return item
  }

  /**
   * Loads the many items of a bulk request in one pass, scope-filtered.
   *
   * Ids the principal may not see simply do not come back, and the caller
   * reports them as not found. A bulk endpoint that answers "you may not touch
   * item X" for an id the caller guessed is an existence oracle over the whole
   * table, one request at a time.
   */
  async findManyForReviewer(principal: Principal, ids: readonly string[]): Promise<ReviewItemView[]> {
    const scoped = await this.scopedItemIds(principal, {
      itemIds: ids,
      reviewerIds: this.reviewerIdsFor(principal),
      take: ids.length,
    })
    return this.loadByIds(scoped)
  }

  /**
   * Confirms a snapshot line exists before anything is written against it.
   *
   * This is the application-layer stand-in for the missing foreign key. It is
   * on the write path because that is the only place it can prevent bad data;
   * checking on read would merely notice the damage afterwards.
   */
  async assertSnapshotLineExists(tx: TransactionClient, snapshotLineId: string): Promise<void> {
    const rows = await tx.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok FROM public.snapshot_line WHERE id = ${snapshotLineId}::uuid LIMIT 1
    `
    if (rows.length === 0) {
      throw new NotFoundException('Baris snapshot yang dirujuk item review tidak ditemukan.')
    }
  }

  /**
   * Loads the full item rows for ids that scopedItemIds has already cleared.
   *
   * Private, and takes ids rather than a filter, so there is no way to reach it
   * without having gone through the scope query first.
   */
  private async loadByIds(ids: readonly string[]): Promise<ReviewItemView[]> {
    if (ids.length === 0) return []

    const rows = await this.prisma.reviewItem.findMany({
      where: { id: { in: [...ids] } },
      include: ReviewItemRepository.include,
    })

    // Preserve the ordering the scope query established; `IN` does not.
    const order = new Map(ids.map((id, index) => [id, index]))
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

    return this.hydrate(rows)
  }

  /**
   * Fills in everything that lives behind snapshot_line.
   *
   * Done as one raw query over the ids rather than per row: the join cannot be
   * expressed as a Prisma relation (no foreign key exists to model), and a
   * per-item lookup would turn a 400-item worklist into 400 round trips.
   */
  private async hydrate(
    rows: Prisma.ReviewItemGetPayload<{ include: typeof ReviewItemRepository.include }>[],
  ): Promise<ReviewItemView[]> {
    if (rows.length === 0) return []

    const lineIds = [...new Set(rows.map((r) => r.snapshotLineId))]

    const lines = await this.prisma.$queryRaw<
      {
        id: string
        account_id: string
        granted_at: Date | null
        granted_by: string | null
        last_access_at: Date | null
        employee_id: string | null
        employee_full_name: string | null
        employee_number: string | null
        job_title: string | null
        org_unit_code: string | null
        org_unit_name: string | null
        entitlement_id: string
        technical_code: string
        display_name: string
        business_description: string | null
        risk_level: ItemRiskProfile['riskLevel']
        is_privileged: boolean
        application_id: string
        application_code: string
        application_name: string
        snapshot_id: string
      }[]
    >`
      SELECT
        sl.id::text                AS id,
        sl.account_id              AS account_id,
        sl.granted_at              AS granted_at,
        sl.granted_by              AS granted_by,
        sl.last_access_at          AS last_access_at,
        sl.employee_id::text       AS employee_id,
        e.full_name                AS employee_full_name,
        e.employee_number          AS employee_number,
        e.job_title                AS job_title,
        ou.code                    AS org_unit_code,
        ou.name                    AS org_unit_name,
        ec.id::text                AS entitlement_id,
        ec.technical_code          AS technical_code,
        ec.display_name            AS display_name,
        ec.business_description    AS business_description,
        ec.risk_level              AS risk_level,
        ec.is_privileged           AS is_privileged,
        a.id::text                 AS application_id,
        a.code                     AS application_code,
        a.name                     AS application_name,
        sl.snapshot_id::text       AS snapshot_id
      FROM public.snapshot_line sl
      JOIN public.entitlement_catalog ec ON ec.id = sl.entitlement_id
      JOIN public.application a          ON a.id = ec.application_id
      LEFT JOIN public.employee e        ON e.id = sl.employee_id
      LEFT JOIN public.organization_unit ou ON ou.id = e.org_unit_id
      WHERE sl.id = ANY(${lineIds}::uuid[])
    `

    const byLine = new Map(lines.map((l) => [l.id, l]))
    const employeeIds = [...new Set(lines.map((l) => l.employee_id).filter((v): v is string => v !== null))]

    const [violations, anomalies, signoffs] = await Promise.all([
      employeeIds.length === 0
        ? Promise.resolve([])
        : this.prisma.sodViolation.findMany({
            where: { employeeId: { in: employeeIds }, status: 'TERBUKA' },
            include: { rule: true },
          }),
      this.prisma.accessAnomaly.findMany({
        where: { snapshotLineId: { in: lineIds }, status: 'TERBUKA' },
      }),
      this.prisma.campaignSignoff.findMany({
        where: { campaignId: { in: [...new Set(rows.map((r) => r.campaignId))] }, isActive: true },
        select: { campaignId: true, signedBy: true, signedAt: true },
      }),
    ])

    return rows.map((row) => {
      const line = byLine.get(row.snapshotLineId)
      const signoff = signoffs.find(
        (s) => s.campaignId === row.campaignId && s.signedBy === row.reviewerId,
      )
      const itemViolations = line?.employee_id
        ? violations.filter(
            (v) =>
              v.employeeId === line.employee_id &&
              (v.entitlementIdA === line.entitlement_id || v.entitlementIdB === line.entitlement_id),
          )
        : []
      const itemAnomalies = anomalies.filter((a) => a.snapshotLineId === row.snapshotLineId)

      const profile: ItemRiskProfile = {
        // A line that could not be resolved is treated as maximally risky
        // rather than as harmless. Missing context must never be the reason an
        // item becomes eligible for a fifty-at-a-time approval.
        isPrivileged: line?.is_privileged ?? true,
        riskLevel: line?.risk_level ?? 'KRITIS',
        hasSodConflict: itemViolations.length > 0,
        hasAnomaly: itemAnomalies.length > 0,
      }

      return {
        id: row.id,
        campaignId: row.campaignId,
        campaignName: row.campaign.name,
        campaignDueDate: row.campaign.dueDate,
        status: row.status,
        reviewerId: row.reviewerId,
        layerNo: row.layerNo,
        accountId: line?.account_id ?? '—',
        employee:
          line?.employee_id && line.employee_full_name
            ? {
                id: line.employee_id,
                fullName: line.employee_full_name,
                employeeNumber: line.employee_number ?? '—',
                jobTitle: line.job_title,
                orgUnitCode: line.org_unit_code ?? '—',
                orgUnitName: line.org_unit_name ?? '—',
              }
            : null,
        application: {
          id: line?.application_id ?? '',
          code: line?.application_code ?? '—',
          name: line?.application_name ?? '—',
        },
        entitlement: {
          id: line?.entitlement_id ?? '',
          code: line?.technical_code ?? '—',
          displayName: line?.display_name ?? '—',
          businessDescription: line?.business_description ?? null,
          riskLevel: profile.riskLevel,
          isPrivileged: profile.isPrivileged,
        },
        context: {
          grantedAt: line?.granted_at ?? null,
          grantedBy: line?.granted_by ?? null,
          lastAccessAt: line?.last_access_at ?? null,
        },
        profile,
        sodConflicts: itemViolations.map((v) => ({
          ruleCode: v.rule.code,
          ruleName: v.rule.name,
          riskDescription: v.rule.riskDescription,
        })),
        anomalies: itemAnomalies.map((a) => ({ code: a.code, severity: a.severity })),
        decision: row.decision
          ? {
              decision: row.decision.decision,
              reason: row.decision.reason,
              decidedByName:
                row.decision.decidedByUser.employee?.fullName ?? row.decision.decidedByUser.externalId,
              decidedAt: row.decision.decidedAt,
              bulkApplied: row.decision.bulkApplied,
              onBehalfOfName:
                row.decision.onBehalfOfUser?.employee?.fullName ??
                row.decision.onBehalfOfUser?.externalId ??
                null,
            }
          : null,
        // K-9: an item covered by an active sign-off from its own reviewer is
        // frozen. Computed per item rather than per campaign because sign-off
        // is per reviewer scope, not per campaign as a whole (FR-B-015 rule 1).
        isSignedOff: signoff !== undefined,
        // The real signature time, carried through rather than left for the UI
        // to substitute "now" for. A screen that renders a plausible-looking
        // timestamp it made up is stating something false about a signature.
        signedOffAt: signoff?.signedAt ?? null,
      }
    })
  }
}
