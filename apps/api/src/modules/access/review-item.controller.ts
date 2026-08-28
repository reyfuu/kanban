import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { ReviewItemStatus } from '@prisma/client'
import { hasPermission, type SigapRequest } from '../shared/index.js'
import { BulkDecisionDto, DecisionDto } from './access.dto.js'
import { presentReviewItem } from './access.presenter.js'
import { ReviewDecisionService } from './review-decision.service.js'
import { ReviewItemRepository } from './review-item.repository.js'

const DEFAULT_TAKE = 100
const MAX_TAKE = 500

/**
 * FR-B-011 s.d. FR-B-013 · 07-API-CONTRACT Sec 5.6.
 *
 * The controller checks the permission and nothing else. Which ROWS a principal
 * may see is decided in ReviewItemRepository (CLAUDE.md rule 1), so an endpoint
 * added here later inherits the filter instead of having to remember it.
 */
@Controller()
export class ReviewItemController {
  constructor(
    private readonly items: ReviewItemRepository,
    private readonly decisions: ReviewDecisionService,
  ) {}

  /** `GET /my/review-items` — the reviewer worklist behind screen L-10. */
  @Get('my/review-items')
  async myItems(
    @Req() req: SigapRequest,
    @Query('campaign_id') campaignId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    this.require(req, 'review:read')

    const rows = await this.items.findForReviewer(req.principal!, {
      ...(campaignId ? { campaignId } : {}),
      ...(parseStatus(status) ? { status: parseStatus(status)! } : {}),
      take: clampTake(limit),
    })

    return { data: rows.map(presentReviewItem) }
  }

  @Get('campaigns/:id/items')
  async campaignItems(
    @Req() req: SigapRequest,
    @Param('id') campaignId: string,
    @Query('reviewer_id') reviewerId?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    this.require(req, 'review:read')

    const rows = await this.items.findForCampaign(req.principal!, campaignId, {
      ...(reviewerId ? { reviewerId } : {}),
      ...(parseStatus(status) ? { status: parseStatus(status)! } : {}),
      take: clampTake(limit),
    })

    return { data: rows.map(presentReviewItem) }
  }

  @Get('review-items/:id')
  async one(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'review:read')
    return { data: presentReviewItem(await this.items.findOneOrFail(req.principal!, id)) }
  }

  /** FR-B-012 · one item, one decision. */
  @Post('review-items/:id/decision')
  @HttpCode(200)
  async decide(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: DecisionDto) {
    this.require(req, 'review:decide')

    const item = await this.items.findOneOrFail(req.principal!, id)
    await this.decisions.assertCampaignAcceptsDecisions(item.campaignId)

    const updated = await this.decisions.decide(
      req.principal!,
      id,
      {
        decision: dto.decision,
        reason: dto.reason ?? null,
        ...(dto.seconds_spent !== undefined ? { secondsSpent: dto.seconds_spent } : {}),
        ...(dto.reassign_to_user_id ? { reassignToUserId: dto.reassign_to_user_id } : {}),
      },
      { ipAddress: req.ip ?? 'unknown' },
    )

    return {
      data: {
        ...presentReviewItem(updated),
        will_create_revocation_ticket: dto.decision === 'CABUT' || dto.decision === 'UBAH',
      },
    }
  }

  /** FR-B-013 · bulk decisions, capped and filtered — K-4. */
  @Post('review-items/bulk-decision')
  @HttpCode(200)
  async bulkDecide(@Req() req: SigapRequest, @Body() dto: BulkDecisionDto) {
    this.require(req, 'review:decide')

    const result = await this.decisions.bulkDecide(
      req.principal!,
      {
        itemIds: dto.item_ids,
        decision: dto.decision,
        reason: dto.reason ?? null,
        ...(dto.seconds_spent !== undefined ? { secondsSpent: dto.seconds_spent } : {}),
      },
      { ipAddress: req.ip ?? 'unknown' },
    )

    return {
      data: {
        applied: result.applied,
        rejected: result.rejected,
        rejections: result.rejections.map((r) => ({
          item_id: r.itemId,
          code: r.code,
          reason: r.reason,
          employee_name: r.employeeName,
          entitlement_display_name: r.entitlementDisplayName,
        })),
        bulk_flag_recorded: result.applied > 0,
      },
    }
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      // 403 rather than 404 here: that this system HAS an access review is not
      // a secret, and the 404 convention protects the existence of individual
      // objects, which the repository already handles by filtering rows.
      throw new ForbiddenException('Anda tidak memiliki hak untuk membuka daftar review.')
    }
  }
}

function parseStatus(value: string | undefined): ReviewItemStatus | undefined {
  if (!value) return undefined
  return (Object.values(ReviewItemStatus) as string[]).includes(value)
    ? (value as ReviewItemStatus)
    : undefined
}

function clampTake(limit: string | undefined): number {
  const raw = Number(limit)
  if (!Number.isFinite(raw) || raw <= 0) return DEFAULT_TAKE
  return Math.min(Math.floor(raw), MAX_TAKE)
}
