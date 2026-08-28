import { createHash, randomUUID } from 'node:crypto'
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import {
  PrismaService,
  UnitOfWork,
  applicationScope,
  type Principal,
} from '../shared/index.js'

/**
 * FR-B-022 / FR-B-023 · the campaign evidence package, and the cross-module
 * bridge that turns an access certification into audit-control evidence.
 *
 * This is the product's headline differentiator (FR-B-023 Alasan rancangan):
 * once a campaign closes, its entire result -- who reviewed what, what they
 * decided and why, who signed it, which revocations were verified, which
 * anomalies and SoD conflicts were found and how they were handled, and which
 * reviewers rubber-stamped -- becomes a single, fingerprinted piece of
 * evidence auto-linked to the periodic access-review controls it satisfies.
 *
 * Three design commitments, each with a reason a later reader would otherwise
 * have to reconstruct:
 *
 * 1. The pack is FROZEN at generation, not recomputed on read. FR-B-022 rule 3
 *    gives it its own fingerprint. A fingerprint over data that changes under
 *    it is a fingerprint over nothing -- reopen a sign-off or land a newer
 *    snapshot after closure and a recomputed pack would silently stop matching
 *    its own hash. So the eight sections are assembled once and stored; the GET
 *    path returns exactly what was fingerprinted.
 *
 * 2. Generation is the act that CLOSES the campaign (FR-B-010:
 *    Selesai -> Ditutup, "paket bukti terbentuk & pencabutan terverifikasi").
 *    Nothing else in the system performs that transition, and the state diagram
 *    makes the pack the trigger. Preconditions -- every item decided, every
 *    scope signed off -- are checked here so a pack is never built over an
 *    unfinished campaign.
 *
 * 3. Revocation status is REPORTED, not gated. K-1 verification depends on a
 *    later snapshot arriving, which may be days out; blocking pack generation
 *    on full verification would make the pack impossible to produce for the
 *    demo and for any campaign whose next snapshot has not landed. The pack
 *    states the truth instead (verified / still-open / failed / excepted), per
 *    FR-X-020 rule 2: a compliance artifact that hides a gap is worse than none.
 *
 * FR-B-022 rule 1 says the pack is built when the campaign is "Ditutup". We
 * read that as the pack-generation action itself performing the close in one
 * transaction, because the lifecycle diagram makes pack generation the only
 * edge into Ditutup -- requiring the campaign to already be Ditutup first would
 * leave no actor able to get it there.
 */
@Injectable()
export class EvidencePackageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * FR-B-022 · assemble and freeze the pack; FR-B-023 · register it as Modul A
   * evidence; FR-B-010 · close the campaign. All in one audited transaction:
   * the pack, the evidence entity, its links and the campaign close either all
   * land or none do.
   */
  async generate(principal: Principal, campaignId: string): Promise<PackSummary> {
    const campaign = await this.requireVisible(principal, campaignId)

    // FR-B-022 rule 1 / idempotency: a campaign closes once, so a pack is
    // generated once. A second call returns a conflict rather than a second
    // pack -- the UNIQUE on campaign_id backs this at the database too.
    const existing = await this.prisma.campaignEvidencePackage.findUnique({
      where: { campaignId },
      select: { id: true },
    })
    if (existing) {
      throw new ConflictException('Paket bukti untuk kampanye ini sudah dibentuk.')
    }

    if (campaign.status === 'DIBATALKAN') {
      throw new ConflictException('Kampanye yang dibatalkan tidak memiliki paket bukti.')
    }
    if (campaign.status === 'DITUTUP') {
      // Closed without a pack row means an inconsistent state we should not
      // paper over; a closed campaign always has its pack (they land together).
      throw new ConflictException('Kampanye sudah ditutup.')
    }

    const contents = await this.assemble(campaign)

    // FR-B-010 preconditions for closure. Checked from the assembled data so
    // the message can be specific rather than a blanket refusal.
    if (contents.scope_summary.undecided_items > 0) {
      throw new ConflictException(
        `Paket bukti hanya dibentuk setelah seluruh item diputuskan; masih ada ${contents.scope_summary.undecided_items} item.`,
      )
    }
    if (!contents.methodology.every_scope_signed_off) {
      throw new ConflictException(
        'Paket bukti hanya dibentuk setelah seluruh sign-off diperoleh untuk setiap cakupan kampanye.',
      )
    }

    const contentHash = fingerprintOf(campaignId, contents)
    const packId = randomUUID()
    const evidenceId = randomUUID()

    // FR-B-023 rule 2: link to every active periodic access-review control. We
    // identify those by their expected evidence types listing the campaign
    // pack -- the control library (Modul A seed) marks ITGC-AC-02 that way. A
    // control that does not expect this evidence is not a target for it.
    const controlIds = await this.periodicAccessControlIds()

    await this.uow.write(async (tx, audit) => {
      // The Modul A evidence entity (FR-B-023 rule 1): system-generated, so
      // EvidenceService refuses user edits to it. Its validity is the campaign
      // period (rule 3).
      await tx.evidence.create({
        data: {
          id: evidenceId,
          title: contents.title,
          description: `Paket bukti kampanye ${campaign.code} yang dibangkitkan sistem (FR-B-022).`,
          evidenceType: 'PAKET_BUKTI_KAMPANYE',
          validityFrom: campaign.startDate,
          validityTo: campaign.dueDate,
          ownerOrgUnitId: null,
          // The pack aggregates decisions across the firm; classify it at the
          // most restrictive sensible level. TERBATAS keeps it off casual view
          // without demanding the RAHASIA handling reserved for secrets.
          classification: 'TERBATAS',
          source: 'DIBANGKITKAN_SISTEM',
          systemGenerated: true,
          status: 'DITERIMA',
          currentVersionNo: 0,
          createdBy: principal.userId,
        },
      })

      await tx.campaignEvidencePackage.create({
        data: {
          id: packId,
          campaignId,
          evidenceId,
          title: contents.title,
          contentHash,
          contents: contents as unknown as Prisma.InputJsonValue,
          generatedBy: principal.userId,
        },
      })

      // FR-A-010 link: the pack evidence points back at the campaign it came
      // from, so a reader on either side reaches the other.
      await tx.evidenceLink.create({
        data: {
          id: randomUUID(),
          evidenceId,
          targetType: 'CAMPAIGN',
          targetId: campaignId,
          note: 'Tautan otomatis paket bukti ke kampanye asalnya (FR-B-023).',
          linkedBy: principal.userId,
        },
      })

      // FR-B-023 rule 2: one link per periodic access-review control.
      for (const controlId of controlIds) {
        await tx.evidenceLink.create({
          data: {
            id: randomUUID(),
            evidenceId,
            targetType: 'CONTROL',
            targetId: controlId,
            note: 'Tautan otomatis ke kontrol akses periodik (FR-B-023 aturan 2).',
            linkedBy: principal.userId,
          },
        })
      }

      // FR-B-010: Selesai/MenungguSignOff -> Ditutup. Guarded so a concurrent
      // cancel cannot be overwritten.
      const closed = await tx.reviewCampaign.updateMany({
        where: { id: campaignId, status: { in: ['MENUNGGU_SIGNOFF', 'SELESAI'] } },
        data: { status: 'DITUTUP' },
      })
      if (closed.count === 0) {
        // Status moved under us (e.g. cancelled between read and write). Abort
        // rather than leave a pack for a campaign that is not closing.
        throw new ConflictException('Status kampanye berubah; paket bukti tidak dibentuk.')
      }

      await audit.record({
        action: 'BENTUK_PAKET_BUKTI_KAMPANYE',
        objectType: 'CAMPAIGN_EVIDENCE_PACKAGE',
        objectId: packId,
        after: {
          campaign_id: campaignId,
          evidence_id: evidenceId,
          content_hash: contentHash,
          linked_control_ids: controlIds,
          contents_summary: {
            decision_detail: contents.decision_detail.length,
            signoff_records: contents.signoff_records.length,
            revocation_status: contents.revocation_status,
            exceptions: contents.exceptions.length,
            anomalies: contents.anomalies.length,
            flagged_reviewers: contents.flagged_reviewers.length,
          },
        },
      })
    })

    return {
      id: packId,
      evidenceId,
      title: contents.title,
      contentHash,
      generatedAt: new Date(),
      linkedControlIds: controlIds,
      contents,
    }
  }

  /** FR-B-022 · read the frozen pack. Returns exactly what was fingerprinted. */
  async findForCampaign(principal: Principal, campaignId: string): Promise<PackSummary> {
    await this.requireVisible(principal, campaignId)
    const pack = await this.prisma.campaignEvidencePackage.findUnique({
      where: { campaignId },
      include: { evidence: { include: { links: { where: { targetType: 'CONTROL' } } } } },
    })
    if (!pack) throw new NotFoundException('Paket bukti belum dibentuk untuk kampanye ini.')

    return {
      id: pack.id,
      evidenceId: pack.evidenceId,
      title: pack.title,
      contentHash: pack.contentHash,
      generatedAt: pack.generatedAt,
      linkedControlIds: pack.evidence.links.map((l) => l.targetId),
      contents: pack.contents as unknown as PackContents,
    }
  }

  /**
   * The eight sections of FR-B-022, drawn from the live campaign data. Called
   * once at generation; the result is frozen.
   */
  private async assemble(campaign: CampaignRow): Promise<PackContents> {
    const [scopes, items, signoffs] = await Promise.all([
      this.prisma.campaignScope.findMany({
        where: { campaignId: campaign.id },
        include: { application: { select: { id: true, code: true, name: true } } },
      }),
      // Every review item with its decision and the employee/entitlement the
      // snapshot line resolves to. snapshot_line has no FK from review_item
      // (see §3 of the handoff), so this is a raw join, same as the sign-off
      // path.
      this.prisma.$queryRaw<DecisionRow[]>`
        SELECT
          ri.id::text                 AS item_id,
          ri.status::text             AS item_status,
          ri.is_flagged               AS is_flagged,
          a.id::text                  AS application_id,
          a.code                      AS application_code,
          ec.display_name             AS entitlement_name,
          ec.is_privileged            AS is_privileged,
          e.full_name                 AS employee_name,
          e.employee_number           AS employee_number,
          reviewer.external_id        AS reviewer_external_id,
          rev_emp.full_name           AS reviewer_name,
          ri.reviewer_id::text        AS reviewer_id,
          rd.decision::text           AS decision,
          rd.reason                   AS reason,
          rd.decided_at               AS decided_at,
          rd.bulk_applied             AS bulk_applied,
          rd.seconds_spent            AS seconds_spent
        FROM public.review_item ri
        JOIN public.snapshot_line sl        ON sl.id = ri.snapshot_line_id
        JOIN public.entitlement_catalog ec  ON ec.id = sl.entitlement_id
        JOIN public.application a           ON a.id = ec.application_id
        LEFT JOIN public.employee e         ON e.id = sl.employee_id
        JOIN public.app_user reviewer       ON reviewer.id = ri.reviewer_id
        LEFT JOIN public.employee rev_emp   ON rev_emp.id = reviewer.employee_id
        LEFT JOIN public.review_decision rd ON rd.review_item_id = ri.id
        WHERE ri.campaign_id = ${campaign.id}::uuid
        ORDER BY ri.id
      `,
      this.prisma.campaignSignoff.findMany({
        where: { campaignId: campaign.id },
        include: {
          signedByUser: { include: { employee: { select: { fullName: true } } } },
          reopenedByUser: { include: { employee: { select: { fullName: true } } } },
        },
        orderBy: { signedAt: 'asc' },
      }),
    ])

    const applicationIds = scopes.map((s) => s.applicationId)

    // Sections 6, 7 and the SoD portion depend on the applications in scope.
    const [anomalies, sodViolations] = await Promise.all([
      this.prisma.accessAnomaly.findMany({
        where: { applicationId: { in: applicationIds } },
        include: {
          application: { select: { code: true } },
          employee: { select: { fullName: true, employeeNumber: true } },
        },
        orderBy: [{ severity: 'asc' }, { firstDetectedAt: 'asc' }],
      }),
      this.prisma.sodViolation.findMany({
        where: {
          OR: [
            { entitlementA: { applicationId: { in: applicationIds } } },
            { entitlementB: { applicationId: { in: applicationIds } } },
          ],
        },
        include: {
          rule: { select: { code: true, name: true, riskLevel: true } },
          employee: { select: { fullName: true, employeeNumber: true } },
          exceptions: {
            where: { isActive: true },
            include: { approvedByUser: { select: { externalId: true } } },
          },
        },
      }),
    ])

    const decided = items.filter((i) => i.decision !== null)
    const undecided = items.length - decided.length

    // Section 1 · scope summary (FR-B-022 point 1).
    const scopeSummary = {
      applications: scopes.map((s) => ({
        id: s.application.id,
        code: s.application.code,
        name: s.application.name,
        item_count: s.itemCount ?? 0,
      })),
      period: {
        start_date: iso(campaign.startDate),
        due_date: iso(campaign.dueDate),
      },
      total_items: items.length,
      decided_items: decided.length,
      undecided_items: undecided,
      reviewer_count: new Set(items.map((i) => i.reviewer_id)).size,
    }

    // Section 2 · methodology (FR-B-022 point 2). The reviewer rule and the
    // scope criteria are what makes the sample defensible to an auditor.
    // A scope is signed off when at least one active sign-off covers each of
    // its applications. Sign-offs do not store their application set directly;
    // we derive coverage by matching each decided item's reviewer to an active
    // signer, then taking the applications those items belong to.
    const activeSignerIds = new Set(signoffs.filter((s) => s.isActive).map((s) => s.signedBy))
    const signedApplications = new Set<string>()
    for (const item of decided) {
      if (activeSignerIds.has(item.reviewer_id)) signedApplications.add(item.application_id)
    }
    const everyScopeSignedOff =
      applicationIds.length > 0 && applicationIds.every((id) => signedApplications.has(id))

    const methodology = {
      reviewer_rule: campaign.reviewerRule as Prisma.JsonValue,
      scope_criteria:
        'Setiap kombinasi identitas dan hak akses dalam cakupan aplikasi menjadi satu item review (FR-B-011).',
      every_scope_signed_off: everyScopeSignedOff,
    }

    // Section 3 · decision detail (FR-B-022 point 3).
    const decisionDetail = decided.map((i) => ({
      item_id: i.item_id,
      application_code: i.application_code,
      entitlement_name: i.entitlement_name,
      is_privileged: i.is_privileged,
      employee_name: i.employee_name,
      employee_number: i.employee_number,
      reviewer_name: i.reviewer_name ?? i.reviewer_external_id,
      decision: i.decision,
      reason: i.reason,
      decided_at: i.decided_at ? i.decided_at.toISOString() : null,
      bulk_applied: i.bulk_applied ?? false,
    }))

    // Section 4 · sign-off records with fingerprints (FR-B-022 point 4).
    const signoffRecords = signoffs.map((s) => ({
      id: s.id,
      signed_by: s.signedByUser.employee?.fullName ?? s.signedByUser.externalId,
      signed_at: s.signedAt.toISOString(),
      layer_no: s.layerNo,
      ip_address: s.ipAddress,
      decision_counts: s.decisionCounts as Prisma.JsonValue,
      content_fingerprint: s.contentFingerprint,
      is_active: s.isActive,
      reopened_at: s.reopenedAt ? s.reopenedAt.toISOString() : null,
      reopened_by: s.reopenedByUser?.employee?.fullName ?? null,
      reopen_reason: s.reopenReason,
    }))

    // Section 5 · revocation status (FR-B-022 point 5). One row per ticket the
    // campaign produced, joined through decision -> review_item.
    const tickets = await this.prisma.$queryRaw<TicketRow[]>`
      SELECT
        rt.id::text                  AS id,
        rt.ticket_no                 AS ticket_no,
        rt.status::text              AS status,
        rt.action_type::text         AS action_type,
        rt.verified_by_snapshot_id::text AS verified_by_snapshot_id,
        a.code                       AS application_code,
        ec.display_name              AS entitlement_name
      FROM public.revocation_ticket rt
      JOIN public.review_decision rd ON rd.id = rt.decision_id
      JOIN public.review_item ri     ON ri.id = rd.review_item_id
      JOIN public.application a      ON a.id = rt.application_id
      JOIN public.entitlement_catalog ec ON ec.id = rt.entitlement_id
      WHERE ri.campaign_id = ${campaign.id}::uuid
      ORDER BY rt.ticket_no
    `
    const revocationSummary = {
      total: tickets.length,
      verified_closed: tickets.filter((t) => t.status === 'TERVERIFIKASI_TERTUTUP').length,
      failed: tickets.filter((t) => t.status === 'GAGAL_DIVERIFIKASI').length,
      excepted: tickets.filter((t) => t.status === 'DIKECUALIKAN').length,
      open: tickets.filter((t) =>
        ['TERBUKA', 'DALAM_PROSES', 'MENUNGGU_VERIFIKASI', 'TIDAK_DAPAT_DIVERIFIKASI'].includes(
          t.status,
        ),
      ).length,
      tickets: tickets.map((t) => ({
        ticket_no: t.ticket_no,
        application_code: t.application_code,
        entitlement_name: t.entitlement_name,
        action_type: t.action_type,
        status: t.status,
        verified_by_snapshot_id: t.verified_by_snapshot_id,
      })),
    }

    // Section 6 · exceptions (FR-B-022 point 6): SoD exceptions with their
    // approver and compensating control.
    const exceptions = sodViolations
      .filter((v) => v.exceptions.length > 0)
      .map((v) => {
        const ex = v.exceptions[0]!
        return {
          sod_rule_code: v.rule.code,
          sod_rule_name: v.rule.name,
          employee_name: v.employee.fullName,
          business_reason: ex.businessReason,
          compensating_control: ex.compensatingControl,
          approved_by: ex.approvedByUser.externalId,
          review_date: iso(ex.reviewDate),
        }
      })

    // Section 7 · anomalies and their handling (FR-B-022 point 7).
    const anomalyDetail = anomalies.map((a) => ({
      id: a.id,
      type: a.code,
      severity: a.severity,
      status: a.status,
      application_code: a.application.code,
      employee_name: a.employee?.fullName ?? null,
      employee_number: a.employee?.employeeNumber ?? null,
      first_detected_at: a.firstDetectedAt.toISOString(),
      exception_reason: a.exceptionReason,
      exception_review_date: a.exceptionReviewDate ? iso(a.exceptionReviewDate) : null,
      resolved_at: a.resolvedAt ? a.resolvedAt.toISOString() : null,
    }))

    // Section 8 · flagged reviewers (FR-B-022 point 8, FR-B-014). The
    // rubber-stamp detector is computed here from the decision data rather than
    // read from a column: no standing detector writes one, and the pack must
    // still tell an auditor whom to spot-check. Indicators 1 and 3 are
    // computable from what we have; indicator 2 (never opened item detail)
    // needs UI telemetry the API does not yet receive, so it is omitted rather
    // than faked.
    const flaggedReviewers = computeFlaggedReviewers(decided)

    return {
      title: `Paket Bukti ${campaign.name}`,
      generated_for_campaign: { id: campaign.id, code: campaign.code, name: campaign.name },
      scope_summary: scopeSummary,
      methodology,
      decision_detail: decisionDetail,
      signoff_records: signoffRecords,
      revocation_status: revocationSummary,
      exceptions,
      anomalies: anomalyDetail,
      flagged_reviewers: flaggedReviewers,
    }
  }

  /**
   * FR-B-023 rule 2 · the active controls a campaign pack should auto-link to.
   *
   * "Periodic access controls" are identified by their expected evidence types
   * including the campaign pack. This keeps the definition in the control
   * library (data) rather than hard-coded here: mark a control as expecting
   * PAKET_BUKTI_KAMPANYE and it starts receiving packs, with no code change.
   */
  private async periodicAccessControlIds(): Promise<string[]> {
    const rows = await this.prisma.control.findMany({
      where: { isActive: true, expectedEvidenceTypes: { has: 'PAKET_BUKTI_KAMPANYE' } },
      select: { id: true },
    })
    return rows.map((r) => r.id)
  }

  /** Scope check shared by generate and read. 404 outside scope (rule 3). */
  private async requireVisible(principal: Principal, campaignId: string): Promise<CampaignRow> {
    const apps = applicationScope(principal)
    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      include: { scopes: { where: apps.whereOn('applicationId'), select: { id: true } } },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')
    if (campaign.scopes.length === 0 && !apps.isUnrestricted) {
      throw new NotFoundException('Kampanye tidak ditemukan.')
    }
    return {
      id: campaign.id,
      code: campaign.code,
      name: campaign.name,
      status: campaign.status,
      startDate: campaign.startDate,
      dueDate: campaign.dueDate,
      reviewerRule: campaign.reviewerRule,
    }
  }
}

interface CampaignRow {
  id: string
  code: string
  name: string
  status: string
  startDate: Date
  dueDate: Date
  reviewerRule: Prisma.JsonValue
}

interface DecisionRow {
  item_id: string
  item_status: string
  is_flagged: boolean
  application_id: string
  application_code: string
  entitlement_name: string
  is_privileged: boolean
  employee_name: string | null
  employee_number: string | null
  reviewer_external_id: string
  reviewer_name: string | null
  reviewer_id: string
  decision: string | null
  reason: string | null
  decided_at: Date | null
  bulk_applied: boolean | null
  seconds_spent: number | null
}

interface TicketRow {
  id: string
  ticket_no: string
  status: string
  action_type: string
  verified_by_snapshot_id: string | null
  application_code: string
  entitlement_name: string
}

export interface PackContents {
  title: string
  generated_for_campaign: { id: string; code: string; name: string }
  scope_summary: {
    applications: { id: string; code: string; name: string; item_count: number }[]
    period: { start_date: string; due_date: string }
    total_items: number
    decided_items: number
    undecided_items: number
    reviewer_count: number
  }
  methodology: {
    reviewer_rule: Prisma.JsonValue
    scope_criteria: string
    every_scope_signed_off: boolean
  }
  decision_detail: unknown[]
  signoff_records: unknown[]
  revocation_status: {
    total: number
    verified_closed: number
    failed: number
    excepted: number
    open: number
    tickets: unknown[]
  }
  exceptions: unknown[]
  anomalies: unknown[]
  flagged_reviewers: FlaggedReviewer[]
}

export interface PackSummary {
  id: string
  evidenceId: string
  title: string
  contentHash: string
  generatedAt: Date
  linkedControlIds: string[]
  contents: PackContents
}

interface FlaggedReviewer {
  reviewer_id: string
  reviewer_name: string
  item_count: number
  indicators: string[]
}

/**
 * FR-B-014 · the rubber-stamp indicators, computed from a campaign's decisions.
 *
 * Indicator 1: all PERTAHANKAN AND more than 20 items AND under 15 seconds per
 * item. Indicator 3: an identical reason across every one of the reviewer's
 * items. Indicator 2 (decided without opening any item detail) needs UI
 * telemetry the API does not capture, so it is not asserted here rather than
 * guessed -- a false flag is as corrosive to trust as a missed one.
 */
export function computeFlaggedReviewers(
  decided: {
    reviewer_id: string
    reviewer_name: string | null
    reviewer_external_id: string
    decision: string | null
    reason: string | null
    seconds_spent: number | null
  }[],
): FlaggedReviewer[] {
  const byReviewer = new Map<string, typeof decided>()
  for (const d of decided) {
    const list = byReviewer.get(d.reviewer_id) ?? []
    list.push(d)
    byReviewer.set(d.reviewer_id, list)
  }

  const flagged: FlaggedReviewer[] = []
  for (const [reviewerId, list] of byReviewer) {
    const indicators: string[] = []

    const allRetain = list.every((d) => d.decision === 'PERTAHANKAN')
    const totalSeconds = list.reduce((sum, d) => sum + Math.max(0, d.seconds_spent ?? 0), 0)
    const perItem = list.length > 0 ? totalSeconds / list.length : 0
    if (allRetain && list.length > 20 && perItem < 15) {
      indicators.push(
        `Seluruh ${list.length} item diputuskan Pertahankan dengan rata-rata ${perItem.toFixed(1)} detik per item (FR-B-014 indikator 1).`,
      )
    }

    const reasons = list.map((d) => (d.reason ?? '').trim()).filter((r) => r.length > 0)
    if (reasons.length > 1 && new Set(reasons).size === 1 && reasons.length === list.length) {
      indicators.push('Alasan identik untuk seluruh item (FR-B-014 indikator 3).')
    }

    if (indicators.length > 0) {
      flagged.push({
        reviewer_id: reviewerId,
        reviewer_name: list[0]!.reviewer_name ?? list[0]!.reviewer_external_id,
        item_count: list.length,
        indicators,
      })
    }
  }
  return flagged.sort((a, b) => b.item_count - a.item_count)
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10)
}

/**
 * FR-B-022 rule 3 · the pack's own cryptographic fingerprint.
 *
 * Same construction as the sign-off fingerprint (CampaignService): a U+001E
 * field separator so two different packs cannot serialise to the same bytes,
 * over a canonical JSON of the frozen contents. Object keys are sorted so the
 * digest depends on content, not on property order.
 */
export function fingerprintOf(campaignId: string, contents: PackContents): string {
  const SEP = '\u001e'
  const hash = createHash('sha256')
  hash.update(['SIGAP-EVIDENCE-PACKAGE-V1', campaignId].join(SEP))
  hash.update(SEP + canonicalJson(contents))
  return hash.digest('hex')
}

/** Deterministic JSON: object keys sorted recursively. */
function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
    a.localeCompare(b),
  )
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`
}
