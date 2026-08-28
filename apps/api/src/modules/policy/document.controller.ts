import {
  BadRequestException,
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
import { hasPermission, RequiresStepUp, type SigapRequest } from '../shared/index.js'
import { DocumentService } from './document.service.js'
import { DocumentApprovalService } from './document-approval.service.js'
import { DocumentSearchService } from './document-search.service.js'
import {
  ApprovalDecisionDto,
  CancelFlowDto,
  CreateDocumentDto,
  CreateVersionDto,
  LinkControlDto,
  PutIntoForceDto,
  SearchDocumentsDto,
  SubmitForReviewDto,
  TransitionDocumentDto,
} from './policy.dto.js'

/**
 * Modul C · Policy Hub HTTP surface (07-API-CONTRACT).
 *
 * Permissions follow the FRD Sec 1.4 authority matrix:
 *   document:read    — search and read; every internal employee holds it
 *   document:write   — author and revise (DOC_AUTHOR)
 *   document:approve — ratify and bring into force (DOC_APPROVER)
 *
 * The permission check here is the coarse gate on the ACTION. It is not the
 * row-level control: which documents a caller may see is decided by
 * `check_document_access` inside the query (FR-C-010), because a controller
 * check is skipped by every other path into the same repository.
 */
@Controller()
export class DocumentController {
  constructor(
    private readonly documents: DocumentService,
    private readonly search: DocumentSearchService,
    private readonly approvals: DocumentApprovalService,
  ) {}

  /** FR-C-009 s.d. FR-C-012 · `GET /documents/search`. */
  @Get('documents/search')
  async searchDocuments(@Req() req: SigapRequest, @Query() dto: SearchDocumentsDto) {
    this.require(req, 'document:read')
    const result = await this.search.search(req.principal!, {
      query: dto.q,
      auditMode: dto.audit_mode === true,
      limit: dto.limit ?? 20,
      filters: {
        ...(dto.document_type ? { documentType: dto.document_type } : {}),
        ...(dto.process_area ? { processArea: dto.process_area } : {}),
        ...(dto.owner_org_unit_id ? { ownerOrgUnitId: dto.owner_org_unit_id } : {}),
        ...(dto.tags ? { tags: dto.tags } : {}),
        ...(dto.effective_from ? { effectiveFrom: new Date(dto.effective_from) } : {}),
        ...(dto.effective_until ? { effectiveUntil: new Date(dto.effective_until) } : {}),
      },
    })
    return { data: result }
  }

  /** FR-C-008 aturan 4 · documents past their review date, still in force. */
  @Get('documents/tinjauan-terlambat')
  async overdue(@Req() req: SigapRequest) {
    this.require(req, 'document:read')
    return { data: await this.documents.listOverdueReviews(req.principal!) }
  }

  @Get('documents/:id')
  async detail(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'document:read')
    return { data: await this.search.detail(req.principal!, id) }
  }

  /** FR-C-007 aturan 3 · `GET /documents/:id/berlaku-pada?tanggal=YYYY-MM-DD`. */
  @Get('documents/:id/berlaku-pada')
  async inForceOn(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Query('tanggal') tanggal: string,
  ) {
    this.require(req, 'document:read')
    return { data: await this.search.versionInForceOn(req.principal!, id, new Date(tanggal)) }
  }

  @Post('documents')
  @HttpCode(201)
  async create(@Req() req: SigapRequest, @Body() dto: CreateDocumentDto) {
    this.require(req, 'document:write')
    const result = await this.documents.create(req.principal!, {
      title: dto.title,
      documentType: dto.document_type,
      ownerOrgUnitId: dto.owner_org_unit_id,
      ownerEmployeeId: dto.owner_employee_id,
      classification: dto.classification,
      processArea: dto.process_area,
      documentNo: dto.document_no ?? null,
      summary: dto.summary ?? null,
      tags: dto.tags ?? [],
      body: dto.body,
      changeSummary: dto.change_summary,
      relatedDocumentIds: dto.related_document_ids ?? [],
    })
    return { data: { id: result.id } }
  }

  @Post('documents/:id/versi')
  @HttpCode(201)
  async createVersion(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: CreateVersionDto,
  ) {
    this.require(req, 'document:write')
    const result = await this.documents.createVersion(req.principal!, id, {
      body: dto.body,
      changeSummary: dto.change_summary,
      kind: dto.kind,
    })
    return { data: { id: result.id } }
  }

  /* ------------------------------------------------ FR-C-005 · alur ------ */

  /** The steps still waiting on the signed-in person. */
  @Get('documents/persetujuan/antrean-saya')
  async myApprovalQueue(@Req() req: SigapRequest) {
    this.require(req, 'document:read')
    return { data: await this.approvals.myQueue(req.principal!) }
  }

  /** FR-C-005 · submit the working version into the configured ladder. */
  @Post('documents/:id/ajukan')
  @HttpCode(202)
  async submit(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: SubmitForReviewDto,
  ) {
    this.require(req, 'document:write')
    const result = await this.approvals.submit(req.principal!, id, {
      isMinor: dto.is_minor === true,
    })
    return { data: { steps: result.steps } }
  }

  /**
   * FR-C-005 aturan 3 & 4 · act on one step.
   *
   * @RequiresStepUp() is aturan 4 and FR-X-003, which names "pengesahan
   * dokumen" explicitly. It sits on the route rather than inside the service so
   * the requirement is visible where the endpoint is defined, and so it is
   * enforced by the global guard before any business code runs.
   *
   * It covers review decisions too, not only ratification. The endpoint is one
   * route, and a guard that applied to only some of its payloads would be a
   * conditional control -- the kind that is one refactor away from being
   * bypassed. Asking a reviewer for their password is a small cost for removing
   * that class of mistake entirely.
   */
  @Post('documents/persetujuan/:stepId')
  @RequiresStepUp()
  @HttpCode(204)
  async decide(
    @Req() req: SigapRequest,
    @Param('stepId') stepId: string,
    @Body() dto: ApprovalDecisionDto,
  ) {
    this.require(req, 'document:read')
    await this.approvals.act(req.principal!, stepId, dto.decision, dto.comment)
  }

  /** FR-C-005 aturan 6 · the author stops the flow before ratification. */
  @Post('documents/:id/hentikan-alur')
  @HttpCode(204)
  async cancelFlow(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: CancelFlowDto,
  ) {
    this.require(req, 'document:write')
    await this.approvals.cancel(req.principal!, id, dto.reason)
  }

  /**
   * FR-C-004 · withdrawal.
   *
   * The only lifecycle move still made directly. Everything between Draf and
   * Disahkan now runs through the approval ladder above, because a document
   * that reached "Disahkan" by a status update nobody signed has not been
   * ratified by anyone -- which is the entire point of FR-C-005.
   *
   * Withdrawal keeps step-up for the same reason ratification has it: taking a
   * procedure out of force is at least as consequential as putting it in.
   */
  @Post('documents/:id/transisi')
  @RequiresStepUp()
  @HttpCode(204)
  async transition(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: TransitionDocumentDto,
  ) {
    this.require(req, 'document:approve')
    if (dto.to !== 'DITARIK') {
      throw new BadRequestException(
        'Hanya penarikan yang dilakukan lewat titik akhir ini. ' +
          'Perpindahan dari Draf sampai Disahkan berjalan lewat alur persetujuan (FR-C-005).',
      )
    }
    await this.documents.transition(req.principal!, id, dto.to, {
      ...(dto.reason ? { reason: dto.reason } : {}),
    })
  }

  /**
   * FR-C-004 aturan 2 & FR-C-007 · bring the ratified version into force.
   *
   * Step-up applies: this is the moment a document starts binding people, and
   * FR-X-003's "pengesahan dokumen" is not meaningfully complete without it.
   */
  @Post('documents/:id/berlakukan')
  @RequiresStepUp()
  @HttpCode(204)
  async putIntoForce(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: PutIntoForceDto,
  ) {
    this.require(req, 'document:approve')
    await this.documents.putIntoForce(req.principal!, id, new Date(dto.effective_from))
  }

  /** FR-C-008 aturan 3 · the owner declares the document still stands. */
  @Post('documents/:id/tetap-berlaku')
  @HttpCode(204)
  async attestUnchanged(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'document:write')
    await this.documents.attestUnchanged(req.principal!, id)
  }

  /** FR-C-022 · link the document to the audit control it underpins. */
  @Post('documents/:id/kontrol')
  @HttpCode(201)
  async linkControl(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Body() dto: LinkControlDto,
  ) {
    this.require(req, 'document:write')
    const result = await this.documents.linkControl(
      req.principal!,
      id,
      dto.control_id,
      dto.note ?? null,
    )
    return { data: { id: result.id } }
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      throw new ForbiddenException('Anda tidak memiliki hak untuk tindakan ini.')
    }
  }
}
