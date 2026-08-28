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
} from '@nestjs/common'
import type { AccessAnomalyCode, FindingStatus, RiskLevel } from '@prisma/client'
import { hasPermission, type SigapRequest } from '../shared/index.js'
import { AnomalyExceptionDto, SodExceptionDto, SodSimulateDto } from './access.dto.js'
import { AnomalyService } from './anomaly.service.js'
import { SodService } from './sod.service.js'

const ANOMALY_CODES = ['AN_01', 'AN_02', 'AN_03', 'AN_04', 'AN_05', 'AN_06', 'AN_07', 'AN_08']
const FINDING_STATUSES = ['TERBUKA', 'DIKECUALIKAN', 'TERSELESAIKAN']
const RISK_LEVELS = ['KRITIS', 'TINGGI', 'SEDANG', 'RENDAH']
const DEFAULT_TAKE = 100
const MAX_TAKE = 500

/**
 * FR-B-007 (anomalies) and FR-B-024/025 (SoD) · 07-API-CONTRACT Sec 5.4, 5.10.
 *
 * Reading findings is `application:read` — an application owner needs to see
 * what was flagged on their own system. Recording an exception is a security
 * judgement reserved for `snapshot:upload`, the SEC_OFFICER permission (FRD
 * Sec 1.4 gives anomaly exceptions to that role), because an exception waves a
 * flagged risk through and must sit with the person accountable for it.
 *
 * The `?type=AN-01` query value uses the hyphenated wire form; the enum stores
 * it as AN_01. The controller maps between them so the contract's examples work
 * verbatim.
 */
@Controller()
export class AnomalyController {
  constructor(
    private readonly anomalies: AnomalyService,
    private readonly sod: SodService,
  ) {}

  /** FR-B-007 · `GET /access-anomalies`. */
  @Get('access-anomalies')
  async listAnomalies(
    @Req() req: SigapRequest,
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('application_id') applicationId?: string,
    @Query('take') take?: string,
  ) {
    this.require(req, 'application:read')
    return {
      data: await this.anomalies.list(req.principal!, {
        ...(type ? { type: this.parseAnomalyCode(type) } : {}),
        ...(status ? { status: this.parseStatus(status) } : {}),
        ...(applicationId ? { applicationId } : {}),
        take: clampTake(take),
      }),
    }
  }

  /** FR-B-007 aturan 2 · `POST /access-anomalies/{id}/exception`. */
  @Post('access-anomalies/:id/exception')
  @HttpCode(200)
  async anomalyException(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: AnomalyExceptionDto,
  ) {
    this.require(req, 'snapshot:upload')
    await this.anomalies.grantException(req.principal!, id, {
      reason: dto.reason,
      compensatingControl: dto.compensating_control,
      reviewDate: dto.review_date,
    })
    return { data: { id, status: 'DIKECUALIKAN' } }
  }

  /** `POST /access-anomalies/{id}/resolve`. */
  @Post('access-anomalies/:id/resolve')
  @HttpCode(200)
  async anomalyResolve(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'snapshot:upload')
    await this.anomalies.resolve(req.principal!, id)
    return { data: { id, status: 'TERSELESAIKAN' } }
  }

  /** FR-B-024 · `GET /sod-rules`. */
  @Get('sod-rules')
  async listSodRules(@Req() req: SigapRequest) {
    this.require(req, 'application:read')
    return { data: await this.sod.listRules(req.principal!) }
  }

  /** FR-B-024 aturan 4 · `POST /sod-rules/simulate` — draft rule, no id yet. */
  @Post('sod-rules/simulate')
  @HttpCode(200)
  async simulate(@Req() req: SigapRequest, @Body() dto: SodSimulateDto) {
    this.require(req, 'snapshot:upload')
    return { data: await this.sod.simulate(req.principal!, { groupA: dto.group_a, groupB: dto.group_b }) }
  }

  /** FR-B-024 · `GET /sod-violations`. */
  @Get('sod-violations')
  async listViolations(
    @Req() req: SigapRequest,
    @Query('status') status?: string,
    @Query('risk_level') riskLevel?: string,
    @Query('take') take?: string,
  ) {
    this.require(req, 'application:read')
    return {
      data: await this.sod.listViolations(req.principal!, {
        ...(status ? { status: this.parseStatus(status) } : {}),
        ...(riskLevel ? { riskLevel: this.parseRisk(riskLevel) } : {}),
        take: clampTake(take),
      }),
    }
  }

  /** FR-B-025 · `POST /sod-violations/{id}/exception`. */
  @Post('sod-violations/:id/exception')
  @HttpCode(200)
  async sodException(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: SodExceptionDto,
  ) {
    this.require(req, 'snapshot:upload')
    await this.sod.grantException(req.principal!, id, {
      businessReason: dto.business_reason,
      compensatingControl: dto.compensating_control,
      approvedBy: dto.approved_by,
      reviewDate: dto.review_date,
    })
    return { data: { id, status: 'DIKECUALIKAN' } }
  }

  private parseAnomalyCode(raw: string): AccessAnomalyCode {
    const normalised = raw.replace('-', '_').toUpperCase()
    if (!ANOMALY_CODES.includes(normalised)) {
      throw new ForbiddenException(`Jenis anomali tidak dikenal: ${raw}.`)
    }
    return normalised as AccessAnomalyCode
  }

  private parseStatus(raw: string): FindingStatus {
    const normalised = raw.toUpperCase()
    if (!FINDING_STATUSES.includes(normalised)) {
      throw new ForbiddenException(`Status tidak dikenal: ${raw}.`)
    }
    return normalised as FindingStatus
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
