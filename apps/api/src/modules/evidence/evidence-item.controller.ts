import {
  Body,
  Controller,
  Delete,
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
import { hasPermission, type SigapRequest } from '../shared/index.js'
import { EvidenceService } from './evidence-item.service.js'
import {
  AddEvidenceVersionDto,
  CreateEvidenceDto,
  CreateEvidenceLinkDto,
} from './evidence-stage2.dto.js'

const DEFAULT_TAKE = 100
const MAX_TAKE = 500

/**
 * Modul A · evidence entities, versions, links and attestation.
 * FR-A-010..014; 07-API-CONTRACT Sec 4.5. Critical control K-8.
 *
 * Reading is control:read, writing control:write. The integrity guarantees
 * (no overwrite, duplicate-SHA refusal, download re-verify) live in the service.
 */
@Controller()
export class EvidenceItemController {
  constructor(private readonly evidence: EvidenceService) {}

  @Get('evidence')
  async list(
    @Req() req: SigapRequest,
    @Query('q') q?: string,
    @Query('control_id') controlId?: string,
    @Query('org_unit_id') orgUnitId?: string,
    @Query('valid_on') validOn?: string,
    @Query('take') take?: string,
  ) {
    this.require(req, 'control:read')
    return {
      data: await this.evidence.list(req.principal!, {
        ...(q ? { q } : {}),
        ...(controlId ? { controlId } : {}),
        ...(orgUnitId ? { orgUnitId } : {}),
        ...(validOn && !Number.isNaN(Date.parse(validOn)) ? { validOn: new Date(validOn) } : {}),
        take: clampTake(take),
      }),
    }
  }

  @Post('evidence')
  @HttpCode(201)
  async create(
    @Req() req: SigapRequest,
    @Body() dto: CreateEvidenceDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.require(req, 'control:write')
    const result = await this.evidence.create(req.principal!, {
      title: dto.title,
      ...(dto.description ? { description: dto.description } : {}),
      evidenceType: dto.evidence_type,
      ...(dto.validity_period ? { validityFrom: new Date(dto.validity_period.from), validityTo: new Date(dto.validity_period.to) } : {}),
      ...(dto.owner_org_unit_id ? { ownerOrgUnitId: dto.owner_org_unit_id } : {}),
      classification: dto.classification,
      source: dto.source,
    })
    res.setHeader('Location', `/api/v1/evidence/${result.id}`)
    return { data: { id: result.id } }
  }

  @Get('evidence/:id')
  async findOne(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.evidence.findOne(req.principal!, id) }
  }

  /** FR-A-011 · add a version. K-8 invariants enforced in the service. */
  @Post('evidence/:id/versions')
  @HttpCode(201)
  async addVersion(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: AddEvidenceVersionDto,
  ) {
    this.require(req, 'control:write')
    const size = Number.parseInt(dto.file_size, 10)
    if (Number.isNaN(size) || size <= 0) {
      throw new ForbiddenException('Ukuran berkas tidak valid.')
    }
    const result = await this.evidence.addVersion(req.principal!, id, {
      storageKey: dto.storage_key,
      fileName: dto.file_name,
      fileSize: size,
      mimeType: dto.mime_type,
      sha256: dto.sha256.toLowerCase(),
    })
    return { data: { evidence_id: id, version_no: result.versionNo } }
  }

  /** FR-A-011 aturan 4 · authenticity attestation. */
  @Get('evidence/:id/attestation')
  async attestation(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.evidence.attestation(req.principal!, id) }
  }

  @Get('evidence/:id/links')
  async links(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.evidence.findOne(req.principal!, id) }
  }

  @Post('evidence/:id/links')
  @HttpCode(201)
  async createLink(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: CreateEvidenceLinkDto,
  ) {
    this.require(req, 'control:write')
    const result = await this.evidence.createLink(req.principal!, id, {
      targetType: dto.target_type,
      targetId: dto.target_id,
      ...(dto.note ? { note: dto.note } : {}),
    })
    return { data: result }
  }

  @Delete('evidence-links/:id')
  @HttpCode(200)
  async deleteLink(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:write')
    await this.evidence.deleteLink(req.principal!, id)
    return { data: { id, deleted: true } }
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
