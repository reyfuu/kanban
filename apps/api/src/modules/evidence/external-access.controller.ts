import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common'
import { hasPermission, type SigapRequest } from '../shared/index.js'
import { ExternalAccessService } from './external-access.service.js'
import {
  ExtendExternalDto,
  InviteExternalDto,
  PortalProposeRequestDto,
} from './evidence-stage2.dto.js'

/**
 * Modul A · external-auditor portal (FR-A-018). 07-API-CONTRACT Sec 4.7.
 *
 * Two audiences. The management endpoints (invite/list/revoke/extend) gate on
 * control:read/write, held by AUDIT_LEAD/COMPLIANCE/AUDITOR_INT. The /portal/*
 * endpoints do NOT gate on control:* -- an external auditor holds no internal
 * permission at all (FR-X-004 rule 3). They authorise on the AUDITOR_EXT role
 * and a live per-engagement grant, both checked in the service.
 */
@Controller()
export class ExternalAccessController {
  constructor(private readonly external: ExternalAccessService) {}

  // --- Management (internal) ---

  @Post('engagements/:id/external-access')
  @HttpCode(201)
  async invite(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: InviteExternalDto) {
    this.require(req, 'control:write')
    const result = await this.external.invite(req.principal!, id, {
      email: dto.email,
      fullName: dto.full_name,
      ...(dto.organization ? { organization: dto.organization } : {}),
      accessUntil: new Date(dto.access_until),
      ...(dto.scope_note ? { scopeNote: dto.scope_note } : {}),
    })
    return {
      data: { id: result.id, email: dto.email, status: 'MENUNGGU_AKTIVASI', mfa_required: true },
    }
  }

  @Get('engagements/:id/external-access')
  async list(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.external.list(req.principal!, id) }
  }

  @Delete('external-access/:id')
  @HttpCode(200)
  async revoke(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:write')
    await this.external.revoke(req.principal!, id)
    return { data: { id, status: 'DICABUT' } }
  }

  @Post('external-access/:id/extend')
  @HttpCode(200)
  async extend(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: ExtendExternalDto) {
    this.require(req, 'control:write')
    await this.external.extend(req.principal!, id, new Date(dto.access_until))
    return { data: { id, access_until: dto.access_until } }
  }

  // --- Portal (external auditor). No control:* gate; role-checked in service. ---

  @Get('portal/engagements')
  async portalEngagements(@Req() req: SigapRequest) {
    if (!req.principal) throw new ForbiddenException('Tidak terautentikasi.')
    return { data: await this.external.portalEngagements(req.principal) }
  }

  @Get('portal/engagements/:id/evidence')
  async portalEvidence(@Req() req: SigapRequest, @Param('id') id: string) {
    if (!req.principal) throw new ForbiddenException('Tidak terautentikasi.')
    return { data: await this.external.portalEvidence(req.principal, id) }
  }

  @Get('portal/evidence/:id/download')
  async portalDownload(@Req() req: SigapRequest, @Param('id') id: string) {
    if (!req.principal) throw new ForbiddenException('Tidak terautentikasi.')
    return { data: await this.external.portalDownload(req.principal, id) }
  }

  @Post('portal/engagements/:id/requests')
  @HttpCode(201)
  async portalPropose(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: PortalProposeRequestDto,
  ) {
    if (!req.principal) throw new ForbiddenException('Tidak terautentikasi.')
    const result = await this.external.portalProposeRequest(req.principal, id, {
      description: dto.description,
      picEmployeeId: dto.pic_employee_id,
      dueDate: new Date(dto.due_date),
    })
    return { data: { ...result, status: 'DIUSULKAN' } }
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      throw new ForbiddenException(`Tindakan ini memerlukan hak akses ${permission}.`)
    }
  }
}
