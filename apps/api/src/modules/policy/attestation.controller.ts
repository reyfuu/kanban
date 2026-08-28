import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common'
import { hasPermission, RequiresStepUp, type SigapRequest } from '../shared/index.js'
import { AttestationService } from './attestation.service.js'
import {
  AttestDto,
  CreateAttestationCampaignDto,
  ReattestationDecisionDto,
} from './policy.dto.js'

/**
 * FR-C-019 s.d. FR-C-021 · policy attestation HTTP surface.
 *
 * Permissions split along the line the FRD draws: running campaigns is a
 * COMPLIANCE responsibility (`attestation:manage`), while attesting is
 * something every employee does for themselves and needs no permission beyond
 * being signed in -- gating it would mean an employee could be bound by a
 * policy they are not permitted to acknowledge.
 */
@Controller()
export class AttestationController {
  constructor(private readonly attestations: AttestationService) {}

  /* ------------------------------------------------- karyawan (diri sendiri) */

  /** The attestations the signed-in person still owes. */
  @Get('attestation/tugas-saya')
  async myTasks(@Req() req: SigapRequest) {
    return { data: await this.attestations.myTasks(req.principal!) }
  }

  /**
   * FR-C-020 · record the statement.
   *
   * The IP address comes from the request, never from the body: an attestation
   * whose IP the attester could choose records nothing.
   */
  @Post('attestation/tugas/:id/nyatakan')
  @HttpCode(201)
  async attest(@Req() req: SigapRequest, @Param('id') id: string, @Body() dto: AttestDto) {
    const result = await this.attestations.attest(req.principal!, id, {
      secondsViewed: dto.seconds_viewed,
      reachedEnd: dto.reached_end === true,
      ipAddress: req.ip ?? null,
    })
    return { data: { id: result.id } }
  }

  /* ----------------------------------------------------- COMPLIANCE (kelola) */

  @Get('attestation/kampanye')
  async list(@Req() req: SigapRequest) {
    this.require(req, 'attestation:manage')
    return { data: await this.attestations.list(req.principal!) }
  }

  @Post('attestation/kampanye')
  @HttpCode(201)
  async create(@Req() req: SigapRequest, @Body() dto: CreateAttestationCampaignDto) {
    this.require(req, 'attestation:manage')
    const result = await this.attestations.create(req.principal!, {
      name: dto.name,
      description: dto.description ?? null,
      documentIds: dto.document_ids,
      targetKind: dto.target_kind,
      targetParams: dto.target_params ?? {},
      startDate: new Date(dto.start_date),
      dueDate: new Date(dto.due_date),
      isMandatory: dto.is_mandatory !== false,
      autoEnrollNewEmployees: dto.auto_enroll_new_employees === true,
    })
    return { data: { id: result.id } }
  }

  /** FR-C-019 · launch: materialise the target population into obligations. */
  @Post('attestation/kampanye/:id/luncurkan')
  @HttpCode(202)
  async launch(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'attestation:manage')
    return { data: await this.attestations.launch(req.principal!, id) }
  }

  /** FR-C-021 aturan 1 · completion overall, per unit, per job title. */
  @Get('attestation/kampanye/:id/progres')
  async progress(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'attestation:manage')
    return { data: await this.attestations.progress(id) }
  }

  /** FR-C-019 aturan 2 · which covered documents changed version mid-campaign. */
  @Post('attestation/kampanye/:id/periksa-versi')
  @HttpCode(200)
  async detectSuperseded(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'attestation:manage')
    return { data: await this.attestations.detectSupersededDocuments(id) }
  }

  /** FR-C-019 aturan 2 · COMPLIANCE decides whether targets must re-attest. */
  @Post('attestation/dokumen/:id/pernyataan-ulang')
  @HttpCode(200)
  async decideReattestation(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: ReattestationDecisionDto,
  ) {
    this.require(req, 'attestation:manage')
    return { data: await this.attestations.decideReattestation(req.principal!, id, dto.required) }
  }

  /**
   * FR-C-021 aturan 2 & FR-A-014 aturan 2 · freeze the report as Modul A
   * evidence, closing the campaign in the same act.
   *
   * Step-up applies: this produces an audit artefact that will be relied on by
   * people who were not in the room, and it permanently closes the campaign.
   */
  @Post('attestation/kampanye/:id/bukti')
  @RequiresStepUp()
  @HttpCode(201)
  async generateEvidence(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'attestation:manage')
    const result = await this.attestations.generateEvidence(req.principal!, id)
    return { data: { evidence_id: result.evidenceId } }
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      throw new ForbiddenException('Anda tidak memiliki hak untuk tindakan ini.')
    }
  }
}
