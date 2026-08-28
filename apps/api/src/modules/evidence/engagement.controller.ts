import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import type { EngagementStatus, EngagementType } from '@prisma/client'
import { hasPermission, RequiresStepUp, type SigapRequest } from '../shared/index.js'
import { EngagementService } from './engagement.service.js'
import { RequestItemService } from './request-item.service.js'
import { FindingService } from './finding.service.js'
import {
  CreateEngagementDto,
  CreateFindingDto,
  CreateRemediationDto,
  CreateRequestItemDto,
  EngagementTransitionDto,
  FindingTransitionDto,
  LegalHoldDto,
  NotApplicableDto,
  ReviewRequestItemDto,
} from './evidence-stage2.dto.js'

const DEFAULT_TAKE = 100
const MAX_TAKE = 500

/**
 * Modul A · engagements, evidence requests and findings.
 * FR-A-004..009, FR-A-016..017; 07-API-CONTRACT Sec 4.3, 4.4, 4.6.
 *
 * Engagement visibility (FR-A-004 rule 3) is enforced in the service layer, not
 * here. Reading is control:read; writing engagements/requests/findings is
 * control:write, held by AUDITOR_INT/AUDIT_LEAD/COMPLIANCE.
 */
@Controller()
export class EngagementController {
  constructor(
    private readonly engagements: EngagementService,
    private readonly requestItems: RequestItemService,
    private readonly findings: FindingService,
  ) {}

  // --- Engagements (FR-A-004, FR-A-005) ---

  @Get('engagements')
  async list(
    @Req() req: SigapRequest,
    @Query('status') status?: string,
    @Query('engagement_type') type?: string,
    @Query('year') year?: string,
    @Query('take') take?: string,
  ) {
    this.require(req, 'control:read')
    return {
      data: await this.engagements.list(req.principal!, {
        ...(status ? { status: status as EngagementStatus } : {}),
        ...(type ? { engagementType: type as EngagementType } : {}),
        ...(year && /^\d{4}$/.test(year) ? { year: Number.parseInt(year, 10) } : {}),
        take: clampTake(take),
      }),
    }
  }

  @Post('engagements')
  @HttpCode(201)
  async create(
    @Req() req: SigapRequest,
    @Body() dto: CreateEngagementDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.require(req, 'control:write')
    const result = await this.engagements.create(req.principal!, {
      title: dto.title,
      engagementType: dto.engagement_type,
      periodFrom: new Date(dto.period_covered.from),
      periodTo: new Date(dto.period_covered.to),
      ...(dto.fieldwork_start ? { fieldworkStart: new Date(dto.fieldwork_start) } : {}),
      ...(dto.fieldwork_end ? { fieldworkEnd: new Date(dto.fieldwork_end) } : {}),
      leadAuditorId: dto.lead_auditor_id,
      teamMemberIds: dto.team_member_ids ?? [],
      controlIds: dto.control_ids ?? [],
    })
    res.setHeader('Location', `/api/v1/engagements/${result.id}`)
    return { data: { id: result.id, code: result.code, status: 'PERENCANAAN' } }
  }

  @Get('engagements/:id')
  async findOne(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.engagements.findOne(req.principal!, id) }
  }

  @Post('engagements/:id/transition')
  @HttpCode(200)
  async transition(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: EngagementTransitionDto,
  ) {
    this.require(req, 'control:write')
    return { data: await this.engagements.transition(req.principal!, id, dto.to_status, dto.reason) }
  }

  @Get('engagements/:id/readiness')
  async readiness(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.engagements.readiness(req.principal!, id) }
  }

  /** FR-A-015 · legal hold. FR-X-003 requires step-up. */
  @Post('engagements/:id/legal-hold')
  @HttpCode(200)
  @RequiresStepUp()
  async setLegalHold(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: LegalHoldDto) {
    this.require(req, 'control:write')
    await this.engagements.setLegalHold(req.principal!, id, true, dto.reason)
    return { data: { id, legal_hold: true } }
  }

  @Post('engagements/:id/legal-hold/release')
  @HttpCode(200)
  @RequiresStepUp()
  async releaseLegalHold(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: LegalHoldDto) {
    this.require(req, 'control:write')
    await this.engagements.setLegalHold(req.principal!, id, false, dto.reason)
    return { data: { id, legal_hold: false } }
  }

  // --- Request items (FR-A-006, FR-A-007, FR-A-009) ---

  @Get('engagements/:id/request-items')
  async listRequestItems(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.requestItems.listForEngagement(req.principal!, id) }
  }

  @Post('engagements/:id/request-items')
  @HttpCode(201)
  async createRequestItem(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: CreateRequestItemDto,
  ) {
    this.require(req, 'control:write')
    const result = await this.requestItems.create(req.principal!, id, {
      description: dto.description,
      ...(dto.control_id ? { controlId: dto.control_id } : {}),
      ...(dto.evidence_period ? { evidencePeriodFrom: new Date(dto.evidence_period.from), evidencePeriodTo: new Date(dto.evidence_period.to) } : {}),
      ...(dto.responsible_org_unit_id ? { responsibleOrgUnitId: dto.responsible_org_unit_id } : {}),
      picEmployeeId: dto.pic_employee_id,
      dueDate: new Date(dto.due_date),
      ...(dto.expected_evidence_type ? { expectedEvidenceType: dto.expected_evidence_type } : {}),
      isMandatory: dto.is_mandatory ?? true,
    })
    return { data: result }
  }

  @Post('engagements/:id/request-items/publish')
  @HttpCode(200)
  async publishRequestItems(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:write')
    return { data: await this.requestItems.publish(req.principal!, id) }
  }

  /** FR-A-009 · the PIC worklist. review:read-equivalent gate is control:read. */
  @Get('my/request-items')
  async myRequestItems(@Req() req: SigapRequest) {
    // No control:read requirement: a PIC is an ordinary employee. Their own
    // task list is theirs to see.
    if (!req.principal) throw new ForbiddenException('Tidak terautentikasi.')
    return { data: await this.requestItems.myTasks(req.principal) }
  }

  @Post('request-items/:id/submit')
  @HttpCode(200)
  async submitRequestItem(@Req() req: SigapRequest, @Param('id') id: string) {
    if (!req.principal) throw new ForbiddenException('Tidak terautentikasi.')
    await this.requestItems.submit(req.principal, id)
    return { data: { id, status: 'DISERAHKAN' } }
  }

  @Post('request-items/:id/review')
  @HttpCode(200)
  async reviewRequestItem(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: ReviewRequestItemDto,
  ) {
    this.require(req, 'control:read')
    await this.requestItems.review(req.principal!, id, dto.decision, dto.reason)
    return { data: { id, decision: dto.decision } }
  }

  @Post('request-items/:id/not-applicable')
  @HttpCode(200)
  async notApplicable(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: NotApplicableDto,
  ) {
    this.require(req, 'control:write')
    await this.requestItems.markNotApplicable(req.principal!, id, dto.reason)
    return { data: { id, status: 'TIDAK_BERLAKU' } }
  }

  // --- Findings (FR-A-016, FR-A-017) ---

  @Get('engagements/:id/findings')
  async listFindings(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.findings.listForEngagement(req.principal!, id) }
  }

  @Post('engagements/:id/findings')
  @HttpCode(201)
  async createFinding(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: CreateFindingDto,
  ) {
    this.require(req, 'control:write')
    const result = await this.findings.create(
      req.principal!,
      id,
      {
        title: dto.title,
        conditionText: dto.condition_text,
        ...(dto.criteria_text ? { criteriaText: dto.criteria_text } : {}),
        ...(dto.cause_text ? { causeText: dto.cause_text } : {}),
        ...(dto.effect_text ? { effectText: dto.effect_text } : {}),
        ...(dto.recommendation ? { recommendation: dto.recommendation } : {}),
        riskLevel: dto.risk_level,
        ...(dto.owner_employee_id ? { ownerEmployeeId: dto.owner_employee_id } : {}),
        ...(dto.recurring_of_id ? { recurringOfId: dto.recurring_of_id } : {}),
      },
      dto.supporting_evidence_ids,
    )
    return { data: result }
  }

  @Get('findings/:id')
  async findFinding(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.findings.findOne(req.principal!, id) }
  }

  @Post('findings/:id/transition')
  @HttpCode(200)
  async transitionFinding(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: FindingTransitionDto,
  ) {
    this.require(req, 'control:write')
    return { data: await this.findings.transition(req.principal!, id, dto.to_status, dto.reason) }
  }

  @Post('findings/:id/remediations')
  @HttpCode(201)
  async addRemediation(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: CreateRemediationDto,
  ) {
    this.require(req, 'control:write')
    const result = await this.findings.addRemediation(req.principal!, id, {
      description: dto.description,
      ownerEmployeeId: dto.owner_employee_id,
      dueDate: new Date(dto.due_date),
    })
    return { data: result }
  }

  @Post('remediations/:id/verify')
  @HttpCode(200)
  async verifyRemediation(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:write')
    await this.findings.verifyRemediation(req.principal!, id)
    return { data: { id, verified: true } }
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      throw new ForbiddenException(`Tindakan ini memerlukan hak akses ${permission}.`)
    }
  }
}

function clampTake(raw: string | undefined): number {
  const parsed = raw ? Number.parseInt(raw, 10) : DEFAULT_TAKE
  if (Number.isNaN(parsed) || parsed <= 0) return DEFAULT_TAKE
  return Math.min(parsed, MAX_TAKE)
}
