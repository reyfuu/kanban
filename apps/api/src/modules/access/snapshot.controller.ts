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
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { hasPermission, type SigapRequest } from '../shared/index.js'
import { CommitUploadDto } from './access.dto.js'
import { RevocationService } from './revocation.service.js'
import { SnapshotService } from './snapshot.service.js'
import {
  MAX_UPLOAD_BYTES,
  SnapshotUploadService,
  type UploadedFile as UploadedFileShape,
} from './snapshot-upload.service.js'

/**
 * FR-B-004 s.d. FR-B-006 · 07-API-CONTRACT Sec 5.2 and 5.3.
 *
 * Two permissions, not one. Reading a snapshot is `application:read`, because
 * an application owner reviewing their own system needs to see what was
 * captured. Creating one is `snapshot:upload`, held only by SEC_OFFICER
 * (FRD Sec 1.4) — a snapshot is the evidence that access was removed (K-1), so
 * whoever can write one can close revocation tickets.
 */
@Controller()
export class SnapshotController {
  constructor(
    private readonly uploads: SnapshotUploadService,
    private readonly snapshots: SnapshotService,
    private readonly revocations: RevocationService,
  ) {}

  /** FR-B-004 aturan 1 · `GET /applications/{id}/upload-template`. */
  @Get('applications/:id/upload-template')
  async template(@Req() req: SigapRequest, @Param('id') id: string, @Res() res: Response) {
    this.require(req, 'snapshot:upload')
    const file = await this.uploads.template(req.principal!, id)
    sendCsv(res, file.fileName, file.body)
  }

  /** FR-B-005 aturan 3 · `GET /applications/{id}/snapshots`. */
  @Get('applications/:id/snapshots')
  async listForApplication(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'application:read')
    return { data: await this.snapshots.listForApplication(req.principal!, id) }
  }

  /**
   * FR-B-004 aturan 3 · `POST /snapshots/upload/validate`.
   *
   * Writes nothing. Everything it reports — row counts, per-row errors, the
   * row-count-drop warning, how many accounts map to nobody — is computed from
   * the same code the commit will run, so the preview is a promise the commit
   * keeps rather than a second implementation that can drift from it.
   */
  @Post('snapshots/upload/validate')
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES } }))
  async validate(
    @Req() req: SigapRequest,
    @UploadedFile() file: UploadedFileShape | undefined,
    @Body('application_id') applicationId?: string,
  ) {
    this.require(req, 'snapshot:upload')
    if (!file) throw new BadRequestException('Berkas tidak disertakan pada bidang `file`.')
    if (!applicationId) throw new BadRequestException('`application_id` wajib disertakan.')

    const preview = await this.uploads.validate(req.principal!, applicationId, file)

    return {
      data: {
        validation_id: preview.validationId,
        total_rows: preview.totalRows,
        valid_rows: preview.validRows,
        invalid_rows: preview.invalidRows,
        warnings: preview.warnings.map((w) => ({
          code: w.code,
          severity: w.severity,
          message: w.message,
          requires_confirmation: w.requiresConfirmation,
        })),
        errors: preview.issues,
        mapping: {
          mapped_accounts: preview.mapping.mapped,
          // FR-B-006 aturan 4, shown while the export can still be fixed.
          unowned_accounts: preview.mapping.unowned,
        },
        error_file_url: `/api/v1/snapshots/upload/${preview.validationId}/errors.csv`,
        expires_at: preview.expiresAt.toISOString(),
      },
    }
  }

  /** FR-B-004 aturan 4 · the rejected rows with their reasons attached. */
  @Get('snapshots/upload/:validationId/errors.csv')
  async errorFile(
    @Req() req: SigapRequest,
    @Param('validationId') validationId: string,
    @Res() res: Response,
  ) {
    this.require(req, 'snapshot:upload')
    const file = await this.uploads.errorFile(req.principal!, validationId)
    sendCsv(res, file.fileName, file.body)
  }

  /**
   * FR-B-004 aturan 5 · `POST /snapshots/upload` — the snapshot lands.
   *
   * Verification of pending revocation tickets (FR-B-020, K-1) runs straight
   * afterwards and against this snapshot alone. That is the whole point of the
   * control: a ticket closes because fresh data proves the access is gone, and
   * this is the moment fresh data arrives. It runs after the commit rather than
   * inside it so that a verification failure cannot roll back a snapshot that
   * was captured correctly — the snapshot is a fact, verification is a reading
   * of it.
   */
  @Post('snapshots/upload')
  @HttpCode(201)
  async commit(@Req() req: SigapRequest, @Body() dto: CommitUploadDto) {
    this.require(req, 'snapshot:upload')

    const result = await this.uploads.commit(req.principal!, {
      validationId: dto.validation_id,
      skipInvalidRows: dto.skip_invalid_rows ?? false,
      confirmWarnings: dto.confirm_warnings ?? [],
      ...(dto.confirmation_note ? { confirmationNote: dto.confirmation_note } : {}),
    })

    const verification = await this.revocations.verifyAgainstSnapshot(result.snapshotId)

    return {
      data: {
        snapshot_id: result.snapshotId,
        line_count: result.lineCount,
        revocation_verification: {
          checked: verification.checked,
          closed: verification.closed,
          failed: verification.failed,
        },
      },
    }
  }

  @Get('snapshots/compare')
  async compare(@Req() req: SigapRequest, @Query('from') from?: string, @Query('to') to?: string) {
    this.require(req, 'application:read')
    if (!from || !to) throw new BadRequestException('Parameter `from` dan `to` wajib diisi.')
    return { data: await this.snapshots.compare(req.principal!, from, to) }
  }

  @Get('snapshots/:id')
  async findOne(@Req() req: SigapRequest, @Param('id') id: string) {
    this.require(req, 'application:read')
    return { data: await this.snapshots.findOne(req.principal!, id) }
  }

  @Get('snapshots/:id/lines')
  async lines(
    @Req() req: SigapRequest,
    @Param('id') id: string,
    @Query('q') q?: string,
    @Query('entitlement_id') entitlementId?: string,
    @Query('employee_id') employeeId?: string,
  ) {
    this.require(req, 'application:read')
    return {
      data: await this.snapshots.listLines(req.principal!, id, {
        ...(q ? { q } : {}),
        ...(entitlementId ? { entitlementId } : {}),
        ...(employeeId ? { employeeId } : {}),
      }),
    }
  }

  private require(req: SigapRequest, permission: string): void {
    if (!req.principal || !hasPermission(req.principal, permission)) {
      throw new ForbiddenException(`Tindakan ini memerlukan hak akses ${permission}.`)
    }
  }
}

function sendCsv(res: Response, fileName: string, body: string): void {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`)
  res.send(body)
}
