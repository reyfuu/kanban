import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Delete,
  Query,
  Req,
  Res,
} from '@nestjs/common'
import type { Response } from 'express'
import type { RiskLevel } from '@prisma/client'
import { hasPermission, type SigapRequest } from '../shared/index.js'
import { ControlService } from './control.service.js'
import { FrameworkService } from './framework.service.js'
import {
  CreateControlDto,
  CreateMappingDto,
  ImportFrameworkItemsDto,
  UpdateControlDto,
} from './evidence.dto.js'

const RISK_LEVELS = ['KRITIS', 'TINGGI', 'SEDANG', 'RENDAH']
const DEFAULT_TAKE = 100
const MAX_TAKE = 500

/**
 * Modul A · Evidence Vault — control library and framework mapping.
 * FR-A-001, FR-A-002, FR-A-003; 07-API-CONTRACT Sec 4.1, 4.2.
 *
 * Reading is `control:read`, writing `control:write`. FRD Sec 1.4 gives control
 * management to AUDITOR_INT, AUDIT_LEAD and COMPLIANCE; the permission mapping
 * in the catalogue reflects that, and every mutating endpoint gates on write.
 */
@Controller()
export class EvidenceController {
  constructor(
    private readonly controls: ControlService,
    private readonly frameworks: FrameworkService,
  ) {}

  // --- Controls (FR-A-001) ---

  @Get('controls')
  async listControls(
    @Req() req: SigapRequest,
    @Query('q') q?: string,
    @Query('risk_level') riskLevel?: string,
    @Query('is_active') isActive?: string,
    @Query('take') take?: string,
  ) {
    this.require(req, 'control:read')
    return {
      data: await this.controls.list(req.principal!, {
        ...(q ? { q } : {}),
        ...(riskLevel ? { riskLevel: this.parseRisk(riskLevel) } : {}),
        ...(isActive !== undefined ? { isActive: isActive === 'true' } : {}),
        take: clampTake(take),
      }),
    }
  }

  @Post('controls')
  @HttpCode(201)
  async createControl(
    @Req() req: SigapRequest,
    @Body() dto: CreateControlDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.require(req, 'control:write')
    const result = await this.controls.create(req.principal!, {
      code: dto.code,
      title: dto.title,
      objective: dto.objective,
      ownerEmployeeId: dto.owner_employee_id,
      ...(dto.executing_org_unit_id ? { executingOrgUnitId: dto.executing_org_unit_id } : {}),
      frequency: dto.frequency,
      controlType: dto.control_type,
      nature: dto.nature,
      riskLevel: dto.risk_level,
      ...(dto.test_procedure ? { testProcedure: dto.test_procedure } : {}),
      expectedEvidenceTypes: dto.expected_evidence_types,
    })
    res.setHeader('Location', `/api/v1/controls/${result.id}`)
    return { data: { id: result.id } }
  }

  @Get('controls/:id')
  async getControl(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.controls.findOne(req.principal!, id) }
  }

  @Patch('controls/:id')
  async updateControl(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: UpdateControlDto,
  ) {
    this.require(req, 'control:write')
    await this.controls.update(req.principal!, id, {
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.objective !== undefined ? { objective: dto.objective } : {}),
      ...(dto.owner_employee_id !== undefined ? { ownerEmployeeId: dto.owner_employee_id } : {}),
      ...(dto.executing_org_unit_id !== undefined ? { executingOrgUnitId: dto.executing_org_unit_id } : {}),
      ...(dto.frequency !== undefined ? { frequency: dto.frequency } : {}),
      ...(dto.control_type !== undefined ? { controlType: dto.control_type } : {}),
      ...(dto.nature !== undefined ? { nature: dto.nature } : {}),
      ...(dto.risk_level !== undefined ? { riskLevel: dto.risk_level } : {}),
      ...(dto.test_procedure !== undefined ? { testProcedure: dto.test_procedure } : {}),
      ...(dto.expected_evidence_types !== undefined
        ? { expectedEvidenceTypes: dto.expected_evidence_types }
        : {}),
    })
    return { data: { id, status: 'DIPERBARUI' } }
  }

  @Get('controls/:id/versions')
  async controlVersions(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.controls.listVersions(req.principal!, id) }
  }

  /** FR-A-001 aturan 3 · retire a control. */
  @Post('controls/:id/retire')
  @HttpCode(200)
  async retireControl(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:write')
    await this.controls.setActive(req.principal!, id, false)
    return { data: { id, is_active: false } }
  }

  @Post('controls/:id/reactivate')
  @HttpCode(200)
  async reactivateControl(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:write')
    await this.controls.setActive(req.principal!, id, true)
    return { data: { id, is_active: true } }
  }

  // --- Frameworks & mapping (FR-A-002, FR-A-003) ---

  @Get('frameworks')
  async listFrameworks(@Req() req: SigapRequest) {
    this.require(req, 'control:read')
    return { data: await this.frameworks.listFrameworks(req.principal!) }
  }

  @Get('frameworks/:id/items')
  async frameworkItems(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.frameworks.listItems(req.principal!, id) }
  }

  @Post('frameworks/:id/items/import')
  @HttpCode(200)
  async importItems(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: ImportFrameworkItemsDto,
  ) {
    this.require(req, 'control:write')
    const result = await this.frameworks.importItems(
      req.principal!,
      id,
      dto.items.map((i) => ({
        ref: i.ref,
        title: i.title,
        ...(i.description !== undefined ? { description: i.description } : {}),
        ...(i.parent_ref !== undefined ? { parentRef: i.parent_ref } : {}),
        ...(i.sort_order !== undefined ? { sortOrder: i.sort_order } : {}),
      })),
    )
    return { data: result }
  }

  /** FR-A-003 aturan 4 · `GET /frameworks/{id}/coverage`. */
  @Get('frameworks/:id/coverage')
  async coverage(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:read')
    return { data: await this.frameworks.coverage(req.principal!, id) }
  }

  @Post('controls/:id/mappings')
  @HttpCode(201)
  async createMapping(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: CreateMappingDto,
  ) {
    this.require(req, 'control:write')
    const result = await this.frameworks.createMapping(req.principal!, id, {
      frameworkItemId: dto.framework_item_id,
      coverageLevel: dto.coverage_level,
      ...(dto.note ? { note: dto.note } : {}),
    })
    return { data: { id: result.id } }
  }

  @Delete('control-mappings/:id')
  @HttpCode(200)
  async deleteMapping(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'control:write')
    await this.frameworks.deleteMapping(req.principal!, id)
    return { data: { id, deleted: true } }
  }

  private parseRisk(raw: string): RiskLevel {
    const normalised = raw.toUpperCase()
    if (!RISK_LEVELS.includes(normalised)) {
      throw new ForbiddenException(`Tingkat risiko tidak dikenal: ${raw}.`)
    }
    return normalised as RiskLevel
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
