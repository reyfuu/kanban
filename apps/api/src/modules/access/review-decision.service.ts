import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import type { CampaignStatus, ReviewDecisionType } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal, type TransactionClient } from '../shared/index.js'
import { ReviewItemRepository, type ReviewItemView } from './review-item.repository.js'
import {
  BULK_MAX_ITEMS,
  MAX_REASSIGNMENTS,
  REASON_MESSAGES,
  bulkExclusionReason,
  reasonRequired,
  validateReason,
} from './review-rules.js'

/** FR-B-010: a campaign only accepts decisions while it is actually running. */
const DECIDABLE_CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['BERJALAN', 'DIPERPANJANG']

export interface DecisionInput {
  readonly decision: ReviewDecisionType
  readonly reason?: string | null
  readonly secondsSpent?: number
  readonly reassignToUserId?: string
}

export interface BulkRejection {
  readonly itemId: string
  readonly code: string
  readonly reason: string
  readonly employeeName: string | null
  readonly entitlementDisplayName: string
}

@Injectable()
export class ReviewDecisionService {
  constructor(
    private readonly items: ReviewItemRepository,
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * FR-B-012 · one reviewer, one item, one decision.
   *
   * K-2 is upheld by what this method does NOT do: there is no code path that
   * writes a decision the reviewer did not send. `decision` is a required field
   * with no fallback, an item with no decision keeps status BELUM_DIPUTUSKAN,
   * and nothing anywhere fills it in later. The control is the absence.
   */
  async decide(
    principal: Principal,
    itemId: string,
    input: DecisionInput,
    context: { ipAddress: string },
  ): Promise<ReviewItemView> {
    const item = await this.items.findOneOrFail(principal, itemId)
    this.assertMayDecide(principal, item)

    const problem = validateReason(input.reason, input.decision, item.profile)
    if (problem) {
      throw new UnprocessableEntityException({
        message: REASON_MESSAGES[problem],
        errors: [{ field: 'reason', code: problem, message: REASON_MESSAGES[problem] }],
      })
    }

    if (input.decision === 'ALIHKAN' && !input.reassignToUserId) {
      throw new UnprocessableEntityException({
        message: 'Pengalihan memerlukan reviewer penerima.',
        errors: [
          {
            field: 'reassign_to_user_id',
            code: 'REASSIGNEE_REQUIRED',
            message: 'Pilih reviewer yang menerima pengalihan.',
          },
        ],
      })
    }

    await this.uow.write(async (tx, audit) => {
      // The substitute for the foreign key the partitioned table cannot have.
      await this.items.assertSnapshotLineExists(tx, await this.snapshotLineIdOf(tx, item.id))

      const before = item.decision
        ? { decision: item.decision.decision, reason: item.decision.reason }
        : null

      await this.writeDecision(tx, {
        item,
        principal,
        input,
        bulkApplied: false,
      })

      if (input.decision === 'ALIHKAN') {
        await this.applyReassignment(tx, item, input.reassignToUserId!)
      }

      await audit.record({
        action: before ? 'UBAH_KEPUTUSAN_REVIEW' : 'PUTUSKAN_REVIEW',
        objectType: 'REVIEW_ITEM',
        objectId: item.id,
        before,
        after: {
          decision: input.decision,
          reason: input.reason ?? null,
          bulk_applied: false,
          seconds_spent: input.secondsSpent ?? 0,
          ip_address: context.ipAddress,
          ...(input.reassignToUserId ? { reassigned_to: input.reassignToUserId } : {}),
        },
      })
    })

    return this.items.findOneOrFail(principal, itemId)
  }

  /**
   * FR-B-013 · bulk decisions with the guard rails that make them acceptable.
   *
   * K-4 lives here. Every item is re-checked server-side against the same
   * eligibility rule the list response advertised, because `bulk_eligible` in
   * that response is a rendering hint and a client is free to ignore it. An
   * ineligible item is reported back with its reason (rule 2) rather than being
   * dropped, and the whole request is capped at 50 (rule 3).
   *
   * Partial success is deliberate, and matches the contract: refusing the whole
   * batch because three of fifty were privileged would push reviewers towards
   * selecting fewer, riskier-looking items in bigger hurries.
   */
  async bulkDecide(
    principal: Principal,
    input: { itemIds: readonly string[]; decision: ReviewDecisionType; reason?: string | null; secondsSpent?: number },
    context: { ipAddress: string },
  ): Promise<{ applied: number; rejected: number; rejections: BulkRejection[] }> {
    if (input.itemIds.length === 0) {
      throw new BadRequestException('Tidak ada item yang dipilih.')
    }
    if (input.itemIds.length > BULK_MAX_ITEMS) {
      throw new UnprocessableEntityException(
        `Keputusan massal maksimum ${BULK_MAX_ITEMS} item sekali terap (FR-B-013).`,
      )
    }
    if (input.decision === 'ALIHKAN') {
      // Reassignment names a recipient per item; one recipient for fifty items
      // is not a bulk decision, it is a reassignment of somebody's whole
      // worklist, which is a different action with a different authority.
      throw new UnprocessableEntityException('Pengalihan tidak dapat dilakukan secara massal.')
    }

    const unique = [...new Set(input.itemIds)]
    const found = await this.items.findManyForReviewer(principal, unique)

    // FR-B-010: the same campaign-status gate the single-item path applies.
    // It lives here rather than in the controller because a rule enforced on
    // one of two routes into the same service is not enforced -- a cancelled
    // campaign would still accept fifty decisions at a time.
    for (const campaignId of new Set(found.map((i) => i.campaignId))) {
      await this.assertCampaignAcceptsDecisions(campaignId)
    }
    const byId = new Map(found.map((i) => [i.id, i]))

    const eligible: ReviewItemView[] = []
    const rejections: BulkRejection[] = []

    for (const id of unique) {
      const item = byId.get(id)
      if (!item) {
        rejections.push({
          itemId: id,
          code: 'NOT_FOUND',
          reason: 'Item review tidak ditemukan.',
          employeeName: null,
          entitlementDisplayName: '—',
        })
        continue
      }

      const rejection = this.bulkRejectionFor(principal, item, input.decision, input.reason)
      if (rejection) rejections.push(rejection)
      else eligible.push(item)
    }

    if (eligible.length === 0) {
      return { applied: 0, rejected: rejections.length, rejections }
    }

    // Spread the reported effort across the batch rather than stamping the
    // whole duration on each row. seconds_spent feeds the rubber-stamping
    // detector (FR-B-014), and recording 180 seconds fifty times would hide
    // exactly the pattern that field exists to expose.
    const perItemSeconds = Math.floor((input.secondsSpent ?? 0) / eligible.length)

    await this.uow.write(async (tx, audit) => {
      for (const item of eligible) {
        await this.writeDecision(tx, {
          item,
          principal,
          input: { decision: input.decision, reason: input.reason ?? null, secondsSpent: perItemSeconds },
          bulkApplied: true,
        })
      }

      // FR-B-013 rule 5: the fact that these came from a bulk action is
      // recorded, and it reaches the evidence package through this entry.
      await audit.record({
        action: 'PUTUSKAN_REVIEW_MASSAL',
        objectType: 'REVIEW_ITEM',
        objectId: eligible[0]!.id,
        after: {
          decision: input.decision,
          reason: input.reason ?? null,
          bulk_applied: true,
          applied_item_ids: eligible.map((i) => i.id),
          rejected_item_ids: rejections.map((r) => r.itemId),
          seconds_spent_total: input.secondsSpent ?? 0,
          ip_address: context.ipAddress,
        },
      })
    })

    return { applied: eligible.length, rejected: rejections.length, rejections }
  }

  /** Reasons an item cannot take part in a bulk decision, in the order a reviewer would care about. */
  private bulkRejectionFor(
    principal: Principal,
    item: ReviewItemView,
    decision: ReviewDecisionType,
    reason: string | null | undefined,
  ): BulkRejection | null {
    const base = {
      itemId: item.id,
      employeeName: item.employee?.fullName ?? null,
      entitlementDisplayName: item.entitlement.displayName,
    }

    if (item.isSignedOff) {
      return { ...base, code: 'ALREADY_SIGNED_OFF', reason: 'Keputusan pada item ini telah ditandatangani.' }
    }
    if (!this.mayDecide(principal, item)) {
      return { ...base, code: 'NOT_REVIEWER', reason: 'Anda bukan reviewer untuk item ini.' }
    }

    const exclusion = bulkExclusionReason(item.profile)
    if (exclusion) return { ...base, code: 'BULK_NOT_ELIGIBLE', reason: exclusion }

    // An item that would need its own reason cannot take a shared one. In
    // practice the eligibility rule above already excludes those, but the check
    // stays: if the two rules ever drift apart, this is the one that prevents a
    // privileged entitlement being retained with somebody else's sentence.
    if (reasonRequired(decision, item.profile) && !reason) {
      return { ...base, code: 'REASON_REQUIRED', reason: REASON_MESSAGES.REASON_REQUIRED }
    }
    const problem = validateReason(reason, decision, item.profile)
    if (problem) return { ...base, code: problem, reason: REASON_MESSAGES[problem] }

    return null
  }

  private async writeDecision(
    tx: TransactionClient,
    args: {
      item: ReviewItemView
      principal: Principal
      input: DecisionInput
      bulkApplied: boolean
    },
  ): Promise<void> {
    const { item, principal, input, bulkApplied } = args

    // FR-X-007 rule 3: a decision taken under delegation records whose
    // authority was used, rather than quietly attributing it to the delegate.
    const onBehalfOf =
      item.reviewerId === principal.userId
        ? null
        : (principal.delegatedFrom.find((d) => d.userId === item.reviewerId)?.userId ?? null)

    const reason = input.reason?.trim() ? input.reason.trim() : null

    await tx.reviewDecision.upsert({
      where: { reviewItemId: item.id },
      create: {
        id: randomUUID(),
        reviewItemId: item.id,
        decision: input.decision,
        reason,
        decidedBy: principal.userId,
        onBehalfOf,
        bulkApplied,
        secondsSpent: Math.max(0, input.secondsSpent ?? 0),
      },
      update: {
        decision: input.decision,
        reason,
        decidedBy: principal.userId,
        onBehalfOf,
        decidedAt: new Date(),
        bulkApplied,
        secondsSpent: Math.max(0, input.secondsSpent ?? 0),
      },
    })

    await tx.reviewItem.update({
      where: { id: item.id },
      data: { status: input.decision === 'ALIHKAN' ? 'DIALIHKAN' : 'DIPUTUSKAN' },
    })
  }

  /**
   * FR-B-012 rule 4 · at most two reassignments, then the item escalates.
   *
   * The count comes from audit_log rather than from a counter column. That is
   * not a shortcut: audit_log is append-only and refuses UPDATE and DELETE
   * (ADR-04), so a reassignment cannot be hidden by rewriting a tally. A
   * counter column can be set back to zero by anything holding UPDATE on
   * review_item; this cannot.
   */
  private async applyReassignment(
    tx: TransactionClient,
    item: ReviewItemView,
    toUserId: string,
  ): Promise<void> {
    const target = await tx.appUser.findUnique({ where: { id: toUserId }, select: { id: true, isActive: true } })
    if (!target?.isActive) throw new NotFoundException('Reviewer penerima tidak ditemukan.')

    const counted = await tx.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) AS count
      FROM public.audit_log
      WHERE object_type = 'REVIEW_ITEM'
        AND object_id = ${item.id}::uuid
        AND after_value ->> 'reassigned_to' IS NOT NULL
    `

    // Reassignments already recorded; this call makes it previous + 1.
    const previous = Number(counted[0]?.count ?? 0n)
    if (previous + 1 > MAX_REASSIGNMENTS) {
      const escalateTo = await tx.appUser.findFirst({
        where: { isActive: true, userRoles: { some: { role: { code: 'SEC_OFFICER' } } } },
        select: { id: true },
      })
      if (!escalateTo) {
        throw new ConflictException(
          'Item telah dialihkan dua kali dan harus naik ke IT Security Officer, tetapi tidak ada pengguna dengan peran tersebut.',
        )
      }
      await tx.reviewItem.update({
        where: { id: item.id },
        data: { reviewerId: escalateTo.id, status: 'ESKALASI', isFlagged: true },
      })
      return
    }

    await tx.reviewItem.update({
      where: { id: item.id },
      data: { reviewerId: toUserId, status: 'BELUM_DIPUTUSKAN' },
    })
    // The reassigned item starts over: the previous reviewer's ALIHKAN is not
    // the new reviewer's decision, and leaving the row behind would let the
    // item count as decided for sign-off purposes without anyone judging it.
    await tx.reviewDecision.deleteMany({ where: { reviewItemId: item.id } })
  }

  private mayDecide(principal: Principal, item: ReviewItemView): boolean {
    if (item.reviewerId === principal.userId) return true
    return principal.delegatedFrom.some((d) => d.userId === item.reviewerId)
  }

  private assertMayDecide(principal: Principal, item: ReviewItemView): void {
    // 404, not 403: the item is visible to this principal's scope but is not
    // theirs to decide. Saying "this exists but is not yours" tells them whose
    // worklist it is on, which is information about somebody else's duties.
    if (!this.mayDecide(principal, item)) throw new NotFoundException('Item review tidak ditemukan.')

    // K-9. Once signed, decisions are immutable; reopening is a SEC_OFFICER
    // action with a recorded reason (FR-B-015 rule 4), not an edit.
    if (item.isSignedOff) {
      throw new ConflictException(
        'Keputusan pada kampanye ini telah ditandatangani dan tidak dapat diubah. ' +
          'Perubahan memerlukan pembukaan kembali oleh IT Security Officer.',
      )
    }
  }

  private async snapshotLineIdOf(tx: TransactionClient, itemId: string): Promise<string> {
    const row = await tx.reviewItem.findUniqueOrThrow({
      where: { id: itemId },
      select: { snapshotLineId: true },
    })
    return row.snapshotLineId
  }

  /** FR-B-010 · used by the controller to explain a refusal in the campaign's own terms. */
  async assertCampaignAcceptsDecisions(campaignId: string): Promise<void> {
    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      select: { status: true, name: true },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')
    if (!DECIDABLE_CAMPAIGN_STATUSES.includes(campaign.status)) {
      throw new ConflictException(
        `Kampanye berstatus ${campaign.status} tidak menerima keputusan baru.`,
      )
    }
  }
}
