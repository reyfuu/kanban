import { createHash, randomUUID } from 'node:crypto'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { ReviewDecisionType } from '@prisma/client'
import {
  applicationScope,
  PrismaService,
  UnitOfWork,
  type Principal,
  type TransactionClient,
} from '../shared/index.js'

export interface SignoffScope {
  readonly applicationIds?: readonly string[]
}

export interface SignoffResult {
  id: string
  campaignId: string
  signedAt: Date
  layerNo: number
  ipAddress: string
  itemCount: number
  applicationCount: number
  byDecision: Record<string, number>
  contentFingerprint: string
}

/** The SLA table in FR-B-018 rule 2, in working days. */
const SLA_WORKING_DAYS = { PRIVILEGED_OR_CRITICAL: 2, DEFAULT: 5 } as const

@Injectable()
export class CampaignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * FR-B-008 · the campaigns a principal may see.
   *
   * Scoped in the same place as everything else. A campaign is visible when it
   * touches at least one application the principal's grants reach; a principal
   * with no application scope is unrestricted, which is what COMPLIANCE and
   * AUDIT_LEAD need in order to oversee campaigns they do not run.
   */
  async list(principal: Principal, status?: string) {
    const apps = applicationScope(principal)

    const campaigns = await this.prisma.reviewCampaign.findMany({
      where: {
        AND: [
          apps.isUnrestricted ? {} : { scopes: { some: apps.whereOn('applicationId') } },
          status ? { status: status as never } : {},
        ],
      },
      include: { scopes: { include: { application: { select: { id: true, code: true, name: true } } } } },
      orderBy: { dueDate: 'asc' },
      take: 100,
    })

    const counts = await this.prisma.reviewItem.groupBy({
      by: ['campaignId', 'status'],
      where: { campaignId: { in: campaigns.map((c) => c.id) } },
      _count: { _all: true },
    })

    return campaigns.map((c) => {
      const mine = counts.filter((r) => r.campaignId === c.id)
      const total = mine.reduce((sum, r) => sum + r._count._all, 0)
      const decided = mine
        .filter((r) => r.status === 'DIPUTUSKAN')
        .reduce((sum, r) => sum + r._count._all, 0)

      return {
        id: c.id,
        code: c.code,
        name: c.name,
        campaign_type: c.campaignType,
        status: c.status,
        start_date: c.startDate.toISOString().slice(0, 10),
        due_date: c.dueDate.toISOString().slice(0, 10),
        total_items: total,
        decided_items: decided,
        completion_percent: total === 0 ? 0 : Math.round((decided / total) * 100),
        applications: c.scopes.map((s) => s.application),
      }
    })
  }

  /** FR-B-015 · the sign-off record, including reopened ones (rule 4 keeps them). */
  async listSignoffs(principal: Principal, campaignId: string) {
    await this.progress(principal, campaignId)

    const rows = await this.prisma.campaignSignoff.findMany({
      where: { campaignId },
      include: {
        signedByUser: { include: { employee: { select: { fullName: true, jobTitle: true } } } },
        reopenedByUser: { include: { employee: { select: { fullName: true } } } },
      },
      orderBy: { signedAt: 'desc' },
    })

    return rows.map((s) => ({
      id: s.id,
      signed_by: {
        id: s.signedBy,
        full_name: s.signedByUser.employee?.fullName ?? s.signedByUser.externalId,
        job_title: s.signedByUser.employee?.jobTitle ?? null,
      },
      signed_at: s.signedAt.toISOString(),
      ip_address: s.ipAddress,
      layer_no: s.layerNo,
      decision_counts: s.decisionCounts,
      content_hash: s.contentFingerprint,
      is_active: s.isActive,
      reopened_at: s.reopenedAt?.toISOString() ?? null,
      reopened_by: s.reopenedByUser?.employee?.fullName ?? null,
      reopen_reason: s.reopenReason,
    }))
  }

  /**
   * FR-B-016 · campaign progress, scope-filtered.
   *
   * The application scope is applied to the campaign's own scope rows, so a
   * principal restricted to two applications sees progress for those two and
   * not a firm-wide total they are not entitled to.
   */
  async progress(principal: Principal, campaignId: string) {
    const apps = applicationScope(principal)

    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      include: {
        scopes: { where: apps.whereOn('applicationId'), include: { application: true } },
      },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')
    // A campaign whose every application is outside the principal's scope is
    // not "a campaign you may not read" -- it is, for them, not a campaign.
    if (campaign.scopes.length === 0 && !apps.isUnrestricted) {
      throw new NotFoundException('Kampanye tidak ditemukan.')
    }

    const grouped = await this.prisma.reviewItem.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { _all: true },
    })
    const byDecision = await this.prisma.reviewDecision.groupBy({
      by: ['decision'],
      where: { reviewItem: { campaignId } },
      _count: { _all: true },
    })

    const total = grouped.reduce((sum, g) => sum + g._count._all, 0)
    const decided = grouped
      .filter((g) => g.status === 'DIPUTUSKAN')
      .reduce((sum, g) => sum + g._count._all, 0)

    return {
      campaign,
      total,
      decided,
      byStatus: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
      byDecision: Object.fromEntries(byDecision.map((g) => [g.decision, g._count._all])),
    }
  }

  /**
   * FR-B-015 · sign-off — critical control K-9.
   *
   * Four things have to hold, and all four are checked here rather than trusted
   * from the request:
   *
   * 1. Re-authentication. Enforced by @RequiresStepUp() on the route, so the
   *    check runs before this method is entered at all (FR-X-003, rule 2).
   * 2. Nothing left undecided in the signer's own scope (rule 1). Counted from
   *    the database, not from a number the client sent.
   * 3. A fingerprint over the exact decision set being signed (rule 3). It is
   *    computed from the rows, so a decision changed after signing produces a
   *    different fingerprint on recomputation and the signature no longer
   *    matches what it claims to cover.
   * 4. Immutability afterwards (rule 4). That is enforced on the write path in
   *    ReviewDecisionService, which refuses to touch an item covered by an
   *    active sign-off.
   */
  async signoff(
    principal: Principal,
    campaignId: string,
    input: { scope: SignoffScope; statement: string },
    context: { ipAddress: string },
  ): Promise<SignoffResult> {
    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true, name: true },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')
    if (campaign.status === 'DIBATALKAN' || campaign.status === 'DITUTUP') {
      throw new ConflictException(`Kampanye berstatus ${campaign.status} tidak dapat ditandatangani.`)
    }

    const existing = await this.prisma.campaignSignoff.findFirst({
      where: { campaignId, signedBy: principal.userId, isActive: true },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('Anda telah menandatangani cakupan ini.')
    }

    // The signer's own items, not the campaign's. FR-B-015 rule 1 is about the
    // scope the signer is responsible for -- one reviewer's outstanding work
    // must not block another reviewer from signing what they finished.
    const scopedItems = await this.itemsInSignoffScope(principal, campaignId, input.scope)

    if (scopedItems.length === 0) {
      throw new ConflictException('Tidak ada item dalam cakupan Anda untuk ditandatangani.')
    }

    const pending = scopedItems.filter((i) => i.decision === null)
    if (pending.length > 0) {
      throw new ConflictException({
        message: `Sign-off tidak dapat dilakukan karena masih terdapat ${pending.length} item yang belum diputuskan.`,
        pending_item_count: pending.length,
        pending_items_url: `/api/v1/my/review-items?campaign_id=${campaignId}&status=BELUM_DIPUTUSKAN`,
      })
    }

    const byDecision = countByDecision(scopedItems)
    const fingerprint = fingerprintOf(scopedItems, {
      campaignId,
      signedBy: principal.userId,
      statement: input.statement,
    })
    const applicationIds = new Set(scopedItems.map((i) => i.applicationId))
    const signoffId = randomUUID()

    // FR-B-015 rule 5 · layer 2 only opens once layer 1 is complete. Derived
    // from the items themselves rather than from a request field, so a signer
    // cannot declare which layer they are signing.
    const layerNo = Math.max(...scopedItems.map((i) => i.layerNo))
    if (layerNo === 2) await this.assertLayerOneComplete(campaignId, scopedItems.map((i) => i.id))

    await this.uow.write(async (tx, audit) => {
      await tx.campaignSignoff.create({
        data: {
          id: signoffId,
          campaignId,
          signedBy: principal.userId,
          layerNo,
          ipAddress: context.ipAddress,
          decisionCounts: byDecision,
          contentFingerprint: fingerprint,
        },
      })

      // FR-B-018 · every signed Cabut/Ubah becomes a ticket. Done inside the
      // sign-off transaction so a ticket cannot be lost between "signed" and
      // "tickets created": either both land or neither does.
      const created = await this.createRevocationTickets(tx, scopedItems)

      await this.advanceCampaignIfComplete(tx, campaignId)

      await audit.record({
        action: 'TANDA_TANGAN_KAMPANYE',
        objectType: 'CAMPAIGN_SIGNOFF',
        objectId: signoffId,
        after: {
          campaign_id: campaignId,
          layer_no: layerNo,
          item_count: scopedItems.length,
          by_decision: byDecision,
          content_fingerprint: fingerprint,
          revocation_tickets_created: created,
          ip_address: context.ipAddress,
          statement: input.statement,
        },
      })
    })

    return {
      id: signoffId,
      campaignId,
      signedAt: new Date(),
      layerNo,
      ipAddress: context.ipAddress,
      itemCount: scopedItems.length,
      applicationCount: applicationIds.size,
      byDecision,
      contentFingerprint: fingerprint,
    }
  }

  /**
   * FR-B-015 rule 4 · reopening, which is the only way past an active sign-off.
   *
   * The previous sign-off is kept (isActive false, reopen fields set), never
   * deleted. A signature that can be erased proves nothing about what was
   * signed, and the schema's reopen columns exist precisely so the record of
   * "this was signed, then reopened by X for reason Y" survives.
   */
  async reopen(principal: Principal, signoffId: string, input: { reason: string }): Promise<void> {
    const signoff = await this.prisma.campaignSignoff.findUnique({
      where: { id: signoffId },
      select: { id: true, isActive: true, campaignId: true, signedBy: true },
    })
    if (!signoff) throw new NotFoundException('Catatan sign-off tidak ditemukan.')
    if (!signoff.isActive) throw new ConflictException('Sign-off ini sudah dibuka kembali.')

    await this.uow.write(async (tx, audit) => {
      await tx.campaignSignoff.update({
        where: { id: signoffId },
        data: {
          isActive: false,
          reopenedAt: new Date(),
          reopenedBy: principal.userId,
          reopenReason: input.reason,
        },
      })
      await audit.record({
        action: 'BUKA_KEMBALI_SIGNOFF',
        objectType: 'CAMPAIGN_SIGNOFF',
        objectId: signoffId,
        before: { is_active: true },
        after: { is_active: false, reopen_reason: input.reason, campaign_id: signoff.campaignId },
      })
    })
  }

  /** The items a sign-off covers, with everything the fingerprint needs. */
  private async itemsInSignoffScope(principal: Principal, campaignId: string, scope: SignoffScope) {
    const applicationIds = scope.applicationIds ?? []
    const rows = await this.prisma.$queryRaw<
      {
        id: string
        layer_no: number
        application_id: string
        decision: ReviewDecisionType | null
        reason: string | null
        decided_at: Date | null
        snapshot_line_id: string
      }[]
    >`
      SELECT
        ri.id::text               AS id,
        ri.layer_no               AS layer_no,
        a.id::text                AS application_id,
        rd.decision               AS decision,
        rd.reason                 AS reason,
        rd.decided_at             AS decided_at,
        ri.snapshot_line_id::text AS snapshot_line_id
      FROM public.review_item ri
      JOIN public.snapshot_line sl       ON sl.id = ri.snapshot_line_id
      JOIN public.entitlement_catalog ec ON ec.id = sl.entitlement_id
      JOIN public.application a          ON a.id = ec.application_id
      LEFT JOIN public.review_decision rd ON rd.review_item_id = ri.id
      WHERE ri.campaign_id = ${campaignId}::uuid
        AND ri.reviewer_id = ${principal.userId}::uuid
        AND (cardinality(${applicationIds}::uuid[]) = 0 OR a.id = ANY(${applicationIds}::uuid[]))
      ORDER BY ri.id
    `
    return rows.map((r) => ({
      id: r.id,
      layerNo: r.layer_no,
      applicationId: r.application_id,
      decision: r.decision,
      reason: r.reason,
      decidedAt: r.decided_at,
      snapshotLineId: r.snapshot_line_id,
    }))
  }

  private async assertLayerOneComplete(campaignId: string, itemIds: readonly string[]): Promise<void> {
    const outstanding = await this.prisma.reviewItem.count({
      where: { campaignId, layerNo: 1, id: { notIn: [...itemIds] }, decision: { is: null } },
    })
    if (outstanding > 0) {
      throw new ConflictException(
        `Sign-off lapis kedua baru terbuka setelah lapis pertama selesai; masih ada ${outstanding} item lapis pertama yang belum diputuskan.`,
      )
    }
  }

  /**
   * FR-B-018 · one ticket per signed Cabut/Ubah decision.
   *
   * The assignee is the application's technical owner, falling back to its
   * business owner (rule 1). The SLA follows rule 2: two working days for
   * privileged entitlements and critical applications, five otherwise.
   */
  private async createRevocationTickets(
    tx: TransactionClient,
    items: { id: string; decision: ReviewDecisionType | null; snapshotLineId: string }[],
  ): Promise<number> {
    const actionable = items.filter((i) => i.decision === 'CABUT' || i.decision === 'UBAH')
    if (actionable.length === 0) return 0

    let created = 0
    for (const item of actionable) {
      const decision = await tx.reviewDecision.findUnique({
        where: { reviewItemId: item.id },
        select: { id: true },
      })
      if (!decision) continue

      const existing = await tx.revocationTicket.findFirst({
        where: { decisionId: decision.id },
        select: { id: true },
      })
      // Re-signing after a reopen must not mint a second ticket for the same
      // decision -- the executor would see two identical jobs and close one.
      if (existing) continue

      const detail = await tx.$queryRaw<
        {
          account_id: string
          entitlement_id: string
          application_id: string
          is_privileged: boolean
          criticality: string
          tech_owner: string | null
          owner: string
        }[]
      >`
        SELECT
          sl.account_id                   AS account_id,
          ec.id::text                     AS entitlement_id,
          a.id::text                      AS application_id,
          ec.is_privileged                AS is_privileged,
          a.criticality::text             AS criticality,
          a.tech_owner_employee_id::text  AS tech_owner,
          a.owner_employee_id::text       AS owner
        FROM public.snapshot_line sl
        JOIN public.entitlement_catalog ec ON ec.id = sl.entitlement_id
        JOIN public.application a          ON a.id = ec.application_id
        WHERE sl.id = ${item.snapshotLineId}::uuid
        LIMIT 1
      `
      const row = detail[0]
      // No line means the review_item points at something that is not there.
      // That is the failure the missing foreign key allows, and a ticket
      // instructing somebody to revoke an unidentifiable access is worse than
      // an aborted sign-off.
      if (!row) {
        throw new NotFoundException(
          `Baris snapshot untuk item review ${item.id} tidak ditemukan; tiket pencabutan tidak dapat dibentuk.`,
        )
      }

      const urgent = row.is_privileged || row.criticality === 'KRITIS'
      const days = urgent ? SLA_WORKING_DAYS.PRIVILEGED_OR_CRITICAL : SLA_WORKING_DAYS.DEFAULT

      await tx.revocationTicket.create({
        data: {
          id: randomUUID(),
          decisionId: decision.id,
          ticketNo: await nextTicketNo(tx),
          applicationId: row.application_id,
          entitlementId: row.entitlement_id,
          accountId: row.account_id,
          actionType: item.decision === 'CABUT' ? 'CABUT' : 'UBAH',
          assigneeId: row.tech_owner ?? row.owner,
          slaDueDate: addWorkingDays(new Date(), days),
          status: 'TERBUKA',
        },
      })
      created += 1
    }

    return created
  }

  /** FR-B-010 · Berjalan → MenungguSignOff once every item has a decision. */
  private async advanceCampaignIfComplete(tx: TransactionClient, campaignId: string): Promise<void> {
    const undecided = await tx.reviewItem.count({ where: { campaignId, decision: { is: null } } })
    if (undecided > 0) return

    await tx.reviewCampaign.updateMany({
      where: { id: campaignId, status: { in: ['BERJALAN', 'DIPERPANJANG'] } },
      data: { status: 'MENUNGGU_SIGNOFF' },
    })
  }
}

function countByDecision(items: { decision: ReviewDecisionType | null }[]): Record<string, number> {
  const counts: Record<string, number> = { PERTAHANKAN: 0, CABUT: 0, UBAH: 0, ALIHKAN: 0 }
  for (const item of items) if (item.decision) counts[item.decision] = (counts[item.decision] ?? 0) + 1
  return counts
}

/**
 * FR-B-015 rule 3 · the cryptographic fingerprint over the signed decision set.
 *
 * Uses the same U+001E field separator as the audit chain, for the same reason:
 * without an unambiguous boundary, two different decision sets serialise to the
 * same byte string, and a fingerprint that collides is a signature over nothing.
 * Items are sorted by id so the digest depends on the content of the set rather
 * than on the order the database happened to return it in.
 */
function fingerprintOf(
  items: { id: string; decision: ReviewDecisionType | null; reason: string | null; decidedAt: Date | null }[],
  header: { campaignId: string; signedBy: string; statement: string },
): string {
  const SEP = '\u001e'
  const hash = createHash('sha256')

  hash.update(['SIGAP-SIGNOFF-V1', header.campaignId, header.signedBy, header.statement].join(SEP))
  for (const item of [...items].sort((a, b) => a.id.localeCompare(b.id))) {
    hash.update(
      SEP +
        [item.id, item.decision ?? '', item.reason ?? '', item.decidedAt?.toISOString() ?? ''].join(SEP),
    )
  }

  return hash.digest('hex')
}

/** Ticket numbers are sequential per year: REV-2026-0188 (07-API-CONTRACT §5.8). */
async function nextTicketNo(tx: TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await tx.$queryRaw<{ next: bigint }[]>`
    SELECT coalesce(max(substring(ticket_no from '[0-9]+$')::bigint), 0) + 1 AS next
    FROM public.revocation_ticket
    WHERE ticket_no LIKE ${`REV-${year}-%`}
  `
  return `REV-${year}-${String(rows[0]?.next ?? 1n).padStart(4, '0')}`
}

/** Working days, Monday to Friday. Public holidays are not modelled yet. */
function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from)
  let remaining = days
  while (remaining > 0) {
    date.setDate(date.getDate() + 1)
    const day = date.getDay()
    if (day !== 0 && day !== 6) remaining -= 1
  }
  return date
}
