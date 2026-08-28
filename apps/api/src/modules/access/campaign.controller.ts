import { Body, Controller, ForbiddenException, Get, HttpCode, Param, Post, Query, Req } from '@nestjs/common'
import { RevocationTicketStatus } from '@prisma/client'
import { hasPermission, RequiresStepUp, type SigapRequest } from '../shared/index.js'
import {
  CancelCampaignDto,
  CompleteTicketDto,
  CreateCampaignDto,
  ExtendCampaignDto,
  ReopenSignoffDto,
  SignoffDto,
  TicketExceptionDto,
} from './access.dto.js'
import { CampaignBuilderService } from './campaign-builder.service.js'
import { CampaignService } from './campaign.service.js'
import { RevocationService } from './revocation.service.js'

/**
 * FR-B-015, FR-B-016, FR-B-018 s.d. FR-B-021 · 07-API-CONTRACT Sec 5.5, 5.7, 5.8.
 */
@Controller()
export class CampaignController {
  constructor(
    private readonly campaigns: CampaignService,
    private readonly builder: CampaignBuilderService,
    private readonly revocations: RevocationService,
  ) {}

  /** `GET /campaigns` — scoped list for the campaign index screen. */
  @Get('campaigns')
  async list(@Req() req: SigapRequest, @Query('status') status?: string) {
    this.require(req, 'campaign:read')
    return { data: await this.campaigns.list(req.principal!, status) }
  }

  /**
   * FR-B-001 · the application registry, and step 1 of the L-09 wizard.
   *
   * Carries the age of each application's latest snapshot, because that is what
   * decides whether it can be included at all (FR-B-008 rule 3). The screen
   * shows it next to the name so the author sees the blocker while choosing,
   * not after clicking launch.
   */
  @Get('applications')
  async applications(@Req() req: SigapRequest) {
    this.require(req, 'application:read')
    return { data: await this.builder.listApplications(req.principal!) }
  }

  /** FR-B-008 · a campaign starts as a draft; nothing is routed until launch. */
  @Post('campaigns')
  @HttpCode(201)
  async create(@Req() req: SigapRequest, @Body() dto: CreateCampaignDto) {
    this.require(req, 'campaign:write')

    const result = await this.builder.create(req.principal!, {
      name: dto.name,
      campaignType: dto.campaign_type,
      applicationIds: dto.application_ids,
      reviewerRule: {
        code: dto.reviewer_rule,
        ...(dto.specific_reviewer_user_id
          ? { specificReviewerUserId: dto.specific_reviewer_user_id }
          : {}),
      },
      fallbackReviewerUserId: dto.fallback_reviewer_user_id,
      startDate: new Date(dto.start_date),
      dueDate: new Date(dto.due_date),
    })

    return { data: { id: result.id, code: result.code, status: 'DRAF' } }
  }

  /**
   * FR-B-008 rule 2 · the preview behind screen L-09 step 4.
   *
   * Resolves through the same path launch does, so the numbers shown are the
   * numbers that will happen. Writes nothing.
   */
  @Post('campaigns/:id/preview')
  @HttpCode(200)
  async preview(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'campaign:write')

    const p = await this.builder.preview(id)
    return {
      data: {
        item_count: p.itemCount,
        reviewer_count: p.reviewerCount,
        application_count: p.applicationCount,
        reviewer_load: {
          lowest: p.load.lowest,
          median: p.load.median,
          highest: p.load.highest,
          heaviest_reviewer: p.load.heaviest
            ? { full_name: p.load.heaviest.fullName, item_count: p.load.heaviest.itemCount }
            : null,
        },
        // Separate lists, because they mean different things to the author:
        // a blocker is something they must fix, a warning something they must
        // see (L-09 rules 1 and 2).
        blockers: p.blockers,
        warnings: p.warnings,
        can_launch: p.blockers.length === 0 && p.itemCount > 0,
        applications: p.perApplication.map((a) => ({
          id: a.applicationId,
          code: a.code,
          name: a.name,
          snapshot_id: a.snapshotId,
          snapshot_age_days: a.snapshotAgeDays,
          line_count: a.lineCount,
        })),
      },
    }
  }

  @Post('campaigns/:id/launch')
  @HttpCode(200)
  async launch(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'campaign:write')
    const result = await this.builder.launch(req.principal!, id)
    return { data: { id, status: 'BERJALAN', item_count: result.itemCount } }
  }

  @Post('campaigns/:id/extend')
  @HttpCode(204)
  async extend(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: ExtendCampaignDto) {
    this.require(req, 'campaign:write')
    await this.builder.extend(req.principal!, id, {
      dueDate: new Date(dto.due_date),
      reason: dto.reason,
    })
  }

  /**
   * FR-B-010 rule 2 · cancellation.
   *
   * Two kinds of caller reach this, and requiring one permission for both makes
   * the endpoint unreachable. A draft is cancelled by whoever builds campaigns
   * (`campaign:write`, held by SEC_OFFICER). A RUNNING campaign needs COMPLIANCE
   * approval -- and COMPLIANCE deliberately does not hold `campaign:write`,
   * because FRD Sec 1.4 makes them an overseer rather than an operator.
   *
   * Demanding both would mean nobody can cancel a running campaign, which is
   * how a rule that reads correctly becomes a dead path. So either suffices to
   * enter, and CampaignBuilderService.cancel enforces the part that matters:
   * a running campaign still refuses anyone without COMPLIANCE.
   */
  @Post('campaigns/:id/cancel')
  @HttpCode(204)
  async cancel(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: CancelCampaignDto) {
    const principal = req.principal
    const mayCancel =
      principal &&
      (hasPermission(principal, 'campaign:write') || principal.roles.includes('COMPLIANCE'))
    if (!mayCancel) throw new ForbiddenException('Anda tidak memiliki hak untuk membatalkan kampanye.')

    await this.builder.cancel(principal, id, { reason: dto.reason })
  }

  @Get('campaigns/:id/progress')
  async progress(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'campaign:read')

    const result = await this.campaigns.progress(req.principal!, id)
    return {
      data: {
        id: result.campaign.id,
        name: result.campaign.name,
        status: result.campaign.status,
        due_date: result.campaign.dueDate.toISOString().slice(0, 10),
        total_items: result.total,
        decided_items: result.decided,
        completion_percent: result.total === 0 ? 0 : Math.round((result.decided / result.total) * 100),
        by_status: result.byStatus,
        by_decision: result.byDecision,
        applications: result.campaign.scopes.map((s) => ({
          id: s.application.id,
          code: s.application.code,
          name: s.application.name,
          item_count: s.itemCount,
        })),
      },
    }
  }

  @Get('campaigns/:id/signoffs')
  async signoffs(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'campaign:read')
    return { data: await this.campaigns.listSignoffs(req.principal!, id) }
  }

  /**
   * FR-B-015 · sign-off — K-9.
   *
   * @RequiresStepUp() is rule 2 of FR-B-015 and FR-X-003, enforced by a global
   * guard before this method runs. It is a decorator rather than a check inside
   * the service so that the requirement is visible on the route itself, where
   * anyone reading the controller can see which actions demand it.
   */
  @Post('campaigns/:id/signoff')
  @RequiresStepUp()
  @HttpCode(201)
  async signoff(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: SignoffDto) {
    this.require(req, 'campaign:signoff')

    const result = await this.campaigns.signoff(
      req.principal!,
      id,
      {
        scope: dto.scope?.application_ids ? { applicationIds: dto.scope.application_ids } : {},
        statement: dto.statement,
      },
      { ipAddress: req.ip ?? 'unknown' },
    )

    return {
      data: {
        id: result.id,
        campaign_id: result.campaignId,
        signed_by: { id: req.principal!.userId, full_name: req.principal!.fullName },
        signed_at: result.signedAt.toISOString(),
        ip_address: result.ipAddress,
        layer_no: result.layerNo,
        scope_summary: {
          application_count: result.applicationCount,
          item_count: result.itemCount,
          by_decision: result.byDecision,
        },
        content_hash: result.contentFingerprint,
      },
    }
  }

  /**
   * FR-B-015 rule 4 · reopening a sign-off.
   *
   * SEC_OFFICER only, and it too requires re-authentication: undoing the lock
   * on a set of signed decisions is at least as consequential as applying it.
   */
  @Post('signoffs/:id/reopen')
  @RequiresStepUp()
  @HttpCode(204)
  async reopen(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: ReopenSignoffDto) {
    if (!req.principal?.roles.includes('SEC_OFFICER')) {
      throw new ForbiddenException('Hanya IT Security Officer yang dapat membuka kembali sign-off.')
    }
    await this.campaigns.reopen(req.principal, id, { reason: dto.reason })
  }

  /** FR-B-018 · `GET /revocation-tickets`. */
  @Get('revocation-tickets')
  async tickets(
    @Req() req: SigapRequest,
    @Query('status') status?: string,
    @Query('application_id') applicationId?: string,
    @Query('overdue') overdue?: string,
  ) {
    this.require(req, 'ticket:read')

    const rows = await this.revocations.list(req.principal!, {
      ...(parseTicketStatus(status) ? { status: parseTicketStatus(status)! } : {}),
      ...(applicationId ? { applicationId } : {}),
      ...(overdue === 'true' ? { overdue: true } : {}),
      take: 200,
    })

    return { data: rows.map(presentTicket) }
  }

  @Get('my/revocation-tickets')
  async myTickets(@Req() req: SigapRequest) {
    this.require(req, 'ticket:read')
    return { data: (await this.revocations.listForAssignee(req.principal!, 200)).map(presentTicket) }
  }

  @Get('revocation-tickets/:id')
  async ticket(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'ticket:read')
    return { data: presentTicket(await this.revocations.findOne(req.principal!, id)) }
  }

  /**
   * FR-B-019 · named ticket actions — K-1.
   *
   * There is no endpoint here that takes a target status, and in particular
   * none that can produce TERVERIFIKASI_TERTUTUP. Marking a ticket done gets it
   * to MENUNGGU_VERIFIKASI; what happens after that is decided by snapshot
   * evidence in `verifyNow` below, never by the person who did the work.
   */
  @Post('revocation-tickets/:id/claim')
  @HttpCode(204)
  async claim(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'ticket:execute')
    await this.revocations.claim(req.principal!, id)
  }

  @Post('revocation-tickets/:id/complete')
  @HttpCode(204)
  async complete(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: CompleteTicketDto) {
    this.require(req, 'ticket:execute')
    await this.revocations.complete(req.principal!, id, {
      executionNote: dto.execution_note,
      ...(dto.external_ticket_ref ? { externalTicketRef: dto.external_ticket_ref } : {}),
    })
  }

  @Post('revocation-tickets/:id/exception')
  @HttpCode(204)
  async exception(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: TicketExceptionDto) {
    this.require(req, 'ticket:execute')
    await this.revocations.grantException(req.principal!, id, { reason: dto.reason })
  }

  /**
   * FR-B-021 · ad-hoc verification.
   *
   * Takes no outcome. It asks the latest completed snapshot whether the access
   * is still there and records what it finds, so triggering it early changes
   * only when the question is asked, never what counts as an answer.
   */
  @Post('revocation-tickets/:id/verify-now')
  @HttpCode(200)
  async verifyNow(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'ticket:execute')
    const result = await this.revocations.verifyNow(req.principal!, id)
    return {
      data: {
        snapshot_id: result.snapshotId,
        checked: result.checked,
        closed: result.closed,
        failed: result.failed,
      },
    }
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      throw new ForbiddenException('Anda tidak memiliki hak untuk tindakan ini.')
    }
  }
}

/** 07-API-CONTRACT §5.8 ticket shape. */
function presentTicket(t: {
  id: string
  ticketNo: string
  application: { id: string; code: string; name: string }
  entitlement: { id: string; displayName: string; isPrivileged: boolean }
  accountId: string
  actionType: string
  assignee: { id: string; fullName: string }
  slaDueDate: Date
  status: string
  verifiedBySnapshotId: string | null
  externalTicketRef: string | null
}) {
  return {
    id: t.id,
    ticket_no: t.ticketNo,
    application: t.application,
    entitlement: {
      id: t.entitlement.id,
      display_name: t.entitlement.displayName,
      is_privileged: t.entitlement.isPrivileged,
    },
    account_id: t.accountId,
    action_type: t.actionType,
    assignee: { id: t.assignee.id, full_name: t.assignee.fullName },
    sla_due_date: t.slaDueDate.toISOString().slice(0, 10),
    status: t.status,
    // Present because K-1 makes it the proof a closure rests on. A closed
    // ticket without one cannot exist; showing it is how a reader checks.
    verified_by_snapshot_id: t.verifiedBySnapshotId,
    external_ticket_ref: t.externalTicketRef,
  }
}

function parseTicketStatus(value: string | undefined): RevocationTicketStatus | undefined {
  if (!value) return undefined
  return (Object.values(RevocationTicketStatus) as string[]).includes(value)
    ? (value as RevocationTicketStatus)
    : undefined
}
