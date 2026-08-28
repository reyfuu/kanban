import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Classification, DocumentType, ProcessArea } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal, type TransactionClient } from '../shared/index.js'
import { chunkDocument } from './document-chunker.js'
import {
  addMonths,
  canTransition,
  defaultReviewCycleMonths,
  mayReference,
  nextVersion,
} from './document-rules.js'

export interface CreateDocumentInput {
  readonly title: string
  readonly documentType: DocumentType
  readonly ownerOrgUnitId: string
  readonly ownerEmployeeId: string
  /** FR-C-003 aturan 1: mandatory, no default. Typed as required for that reason. */
  readonly classification: Classification
  readonly processArea: ProcessArea
  readonly documentNo?: string | null
  readonly summary?: string | null
  readonly tags?: readonly string[]
  readonly body: string
  readonly changeSummary: string
  readonly relatedDocumentIds?: readonly string[]
}

export interface NewVersionInput {
  readonly body: string
  readonly changeSummary: string
  readonly kind: 'MAYOR' | 'MINOR'
}

/**
 * Modul C · the document lifecycle (FR-C-003, FR-C-004, FR-C-006, FR-C-007,
 * FR-C-008).
 *
 * Three properties this service is responsible for, each of which is a
 * governance rule rather than an implementation detail:
 *
 * - **No default classification** (FR-C-003 aturan 1, FR-X-018 aturan 1). The
 *   input type makes it required, the column has no DEFAULT, and nothing here
 *   substitutes a fallback. A document filed at the wrong classification is an
 *   access-control failure, so guessing is worse than refusing.
 *
 * - **No gap at supersession** (FR-C-004 aturan 2). Bringing a version into
 *   force and superseding the previous one happen in one transaction. Two
 *   statements in two transactions leave a window in which either two versions
 *   or no version is in force; for an operating procedure, that window is the
 *   whole risk.
 *
 * - **Never revoke automatically** (FR-C-008 alasan rancangan). An overdue
 *   review marks the document late; it does not withdraw it. Automatically
 *   voiding a procedure because of an administrative delay creates a rule
 *   vacuum more dangerous than a slightly stale document.
 *
 * Every write goes through UnitOfWork, so the audit entry lands in the same
 * transaction or neither does (aturan kode #2).
 */
@Injectable()
export class DocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /** FR-C-003 · create a document together with its first draft version. */
  async create(principal: Principal, input: CreateDocumentInput): Promise<{ id: string }> {
    await this.assertOwnersExist(input.ownerOrgUnitId, input.ownerEmployeeId)
    await this.assertHierarchy(input.documentType, input.relatedDocumentIds ?? [])

    if (input.documentNo) {
      const clash = await this.prisma.document.findUnique({
        where: { documentNo: input.documentNo },
        select: { id: true },
      })
      if (clash) throw new ConflictException(`Nomor dokumen "${input.documentNo}" sudah dipakai.`)
    }

    const documentId = randomUUID()
    const versionId = randomUUID()
    const cycle = defaultReviewCycleMonths(input.documentType)

    await this.uow.write(async (tx, audit) => {
      await tx.document.create({
        data: {
          id: documentId,
          documentNo: input.documentNo ?? null,
          title: input.title,
          documentType: input.documentType,
          ownerOrgUnitId: input.ownerOrgUnitId,
          ownerEmployeeId: input.ownerEmployeeId,
          classification: input.classification,
          processArea: input.processArea,
          tags: [...(input.tags ?? [])],
          summary: input.summary ?? null,
          reviewCycleMonths: cycle,
          status: 'DRAF',
          createdBy: principal.userId,
        },
      })
      await tx.documentVersion.create({
        data: {
          id: versionId,
          documentId,
          versionMajor: 1,
          versionMinor: 0,
          body: input.body,
          extractedText: input.body,
          changeSummary: input.changeSummary,
          status: 'DRAF',
          createdBy: principal.userId,
        },
      })
      await this.reindex(tx, versionId, input.title, input.body)
      await audit.record({
        action: 'BUAT_DOKUMEN',
        objectType: 'DOCUMENT',
        objectId: documentId,
        after: {
          title: input.title,
          document_type: input.documentType,
          classification: input.classification,
          process_area: input.processArea,
        },
      })
    })

    return { id: documentId }
  }

  /**
   * FR-C-004 · withdrawal, and only withdrawal.
   *
   * Every move between Draf and Disahkan belongs to the approval flow
   * (FR-C-005, `DocumentApprovalService`) and is refused here. That refusal is
   * the control, not a routing preference: a document that reached "Disahkan"
   * by a status update has been ratified by nobody, and a service method that
   * can produce that state is one careless call away from producing it. The
   * approval ladder is the only way in, so the signatures always exist.
   *
   * The legal moves still come from `document-rules.ts`, which transcribes the
   * state diagram, so the transition is validated against the same table the
   * flow uses.
   */
  async transition(
    principal: Principal,
    documentId: string,
    to: string,
    options: { reason?: string } = {},
  ): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, title: true },
    })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan.')

    if (!canTransition(doc.status, to)) {
      throw new ConflictException(
        `Dokumen berstatus ${doc.status} tidak dapat berpindah ke ${to}.`,
      )
    }
    // The approval ladder owns everything up to ratification. See the method
    // comment: this refusal is why a Disahkan document always has signatures.
    if (to !== 'DITARIK') {
      throw new BadRequestException(
        `Perpindahan ke ${to} berjalan lewat alur persetujuan (FR-C-005), bukan lewat pembaruan status. ` +
          'Gunakan pengajuan telaah dan keputusan pada tiap langkah.',
      )
    }
    // FR-C-004 aturan 4: withdrawal without a recorded reason is exactly the
    // audit gap this system exists to close, so it is refused, not defaulted.
    if (to === 'DITARIK' && !options.reason?.trim()) {
      throw new BadRequestException('Penarikan dokumen wajib disertai alasan.')
    }
    await this.uow.write(async (tx, audit) => {
      await tx.document.update({
        where: { id: documentId },
        data: {
          status: to as never,
          ...(to === 'DITARIK'
            ? { withdrawnReason: options.reason!.trim(), withdrawnAt: new Date() }
            : {}),
        },
      })
      // A withdrawal takes the in-force version out with it. Drafts are left
      // alone: withdrawing what is published says nothing about a revision
      // somebody is still writing.
      await tx.documentVersion.updateMany({
        where: { documentId, status: 'BERLAKU' },
        data: { status: 'DITARIK' },
      })
      await audit.record({
        action: 'UBAH_STATUS_DOKUMEN',
        objectType: 'DOCUMENT',
        objectId: documentId,
        before: { status: doc.status },
        after: { status: to, ...(options.reason ? { reason: options.reason } : {}) },
      })
    })
  }

  /**
   * FR-C-004 aturan 2 & FR-C-007 · bring the approved version into force.
   *
   * The previous in-force version becomes DIGANTIKAN in the same transaction,
   * "tanpa jeda". The database also holds a partial unique index allowing only
   * one BERLAKU version per document, so if this method were ever changed to
   * skip the supersession the write would fail rather than leave two
   * conflicting procedures in force.
   */
  async putIntoForce(
    principal: Principal,
    documentId: string,
    effectiveFromInput: Date,
  ): Promise<void> {
    // A force date is a CALENDAR date, not an instant. Prisma stores @db.Date
    // by truncating in UTC, so a Date built from local midnight in UTC+7 lands
    // on the previous calendar day and a document ratified today can be
    // rejected as "berlaku sebelum disahkan". Normalising both sides to a UTC
    // calendar date removes the whole class of off-by-one-day bugs, which for
    // a document's period of force is not a rounding error -- it decides which
    // rule bound people on a given day.
    const effectiveFrom = toUtcDateOnly(effectiveFromInput)
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, reviewCycleMonths: true },
    })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan.')

    const approved = await this.prisma.documentVersion.findFirst({
      where: { documentId, status: 'DISAHKAN' },
      orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
      select: { id: true, approvedAt: true, versionMajor: true, versionMinor: true },
    })
    if (!approved) {
      throw new ConflictException('Tidak ada versi berstatus Disahkan untuk diberlakukan.')
    }
    // FR-C-007 aturan 1.
    if (approved.approvedAt && effectiveFrom < toUtcDateOnly(approved.approvedAt)) {
      throw new BadRequestException(
        'Tanggal berlaku tidak boleh lebih awal dari tanggal pengesahan.',
      )
    }

    await this.uow.write(async (tx, audit) => {
      const current = await tx.documentVersion.findFirst({
        where: { documentId, status: 'BERLAKU' },
        select: { id: true, versionMajor: true, versionMinor: true },
      })

      if (current) {
        // Same transaction, before the new one takes force: the partial unique
        // index would reject the alternative ordering, which is the point.
        await tx.documentVersion.update({
          where: { id: current.id },
          data: {
            status: 'DIGANTIKAN',
            effectiveUntil: addDays(effectiveFrom, -1),
          },
        })
      }

      await tx.documentVersion.update({
        where: { id: approved.id },
        data: { status: 'BERLAKU', effectiveFrom },
      })

      await tx.document.update({
        where: { id: documentId },
        data: {
          status: 'BERLAKU',
          nextReviewDate: addMonths(effectiveFrom, doc.reviewCycleMonths),
        },
      })

      await audit.record({
        action: 'BERLAKUKAN_DOKUMEN',
        objectType: 'DOCUMENT',
        objectId: documentId,
        before: current
          ? { version: `${current.versionMajor}.${current.versionMinor}`, status: 'BERLAKU' }
          : undefined,
        after: {
          version: `${approved.versionMajor}.${approved.versionMinor}`,
          effective_from: effectiveFrom.toISOString().slice(0, 10),
        },
      })
    })
  }

  /**
   * FR-C-006 · start a new version. The in-force version keeps being served to
   * ordinary readers while this one is drafted (FR-C-004 aturan 3): it is a
   * separate row, and only search's status filter decides who sees which.
   */
  async createVersion(
    principal: Principal,
    documentId: string,
    input: NewVersionInput,
  ): Promise<{ id: string }> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, title: true },
    })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan.')
    if (doc.status !== 'BERLAKU' && doc.status !== 'DALAM_REVISI') {
      throw new ConflictException('Versi baru hanya dapat dimulai dari dokumen yang berlaku.')
    }
    if (!input.changeSummary.trim()) {
      // FR-C-006 aturan 4. Also NOT NULL in the database; refused here so the
      // caller gets a sentence rather than a constraint violation.
      throw new BadRequestException('Ringkasan perubahan wajib diisi.')
    }

    const latest = await this.prisma.documentVersion.findFirst({
      where: { documentId },
      orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
      select: { versionMajor: true, versionMinor: true },
    })
    const next = nextVersion(
      { major: latest?.versionMajor ?? 1, minor: latest?.versionMinor ?? 0 },
      input.kind,
    )

    const versionId = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.documentVersion.create({
        data: {
          id: versionId,
          documentId,
          versionMajor: next.major,
          versionMinor: next.minor,
          body: input.body,
          extractedText: input.body,
          changeSummary: input.changeSummary,
          status: 'DRAF',
          createdBy: principal.userId,
        },
      })
      await tx.document.update({ where: { id: documentId }, data: { status: 'DALAM_REVISI' } })
      await this.reindex(tx, versionId, doc.title, input.body)
      await audit.record({
        action: 'BUAT_VERSI_DOKUMEN',
        objectType: 'DOCUMENT',
        objectId: documentId,
        after: { version: `${next.major}.${next.minor}`, change_summary: input.changeSummary },
      })
    })

    return { id: versionId }
  }

  /**
   * FR-C-008 aturan 3 · the owner attests the document still stands unchanged.
   * Recorded, and it resets the review cycle. This is the cheap path that keeps
   * a correct document from drifting into "Terlambat Ditinjau" for no reason.
   */
  async attestUnchanged(principal: Principal, documentId: string): Promise<void> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { id: true, status: true, reviewCycleMonths: true, nextReviewDate: true, ownerEmployeeId: true },
    })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan.')
    if (doc.status !== 'BERLAKU') {
      throw new ConflictException('Hanya dokumen berlaku yang dapat dinyatakan tetap berlaku.')
    }

    const next = addMonths(new Date(), doc.reviewCycleMonths)
    await this.uow.write(async (tx, audit) => {
      await tx.document.update({ where: { id: documentId }, data: { nextReviewDate: next } })
      await audit.record({
        action: 'NYATAKAN_TETAP_BERLAKU',
        objectType: 'DOCUMENT',
        objectId: documentId,
        before: { next_review_date: doc.nextReviewDate?.toISOString().slice(0, 10) ?? null },
        after: { next_review_date: next.toISOString().slice(0, 10) },
      })
    })
  }

  /**
   * FR-C-008 aturan 4 · documents past their review date.
   *
   * They stay in force. This returns the list for the compliance dashboard and
   * RPT-11; nothing here changes a status.
   */
  async listOverdueReviews(_principal: Principal, limit = 100) {
    return this.prisma.document.findMany({
      where: { status: 'BERLAKU', nextReviewDate: { lt: new Date() } },
      select: {
        id: true,
        documentNo: true,
        title: true,
        documentType: true,
        nextReviewDate: true,
        ownerEmployee: { select: { fullName: true } },
      },
      orderBy: { nextReviewDate: 'asc' },
      take: limit,
    })
  }

  /** FR-C-022 · link a document to the audit control it underpins. */
  async linkControl(
    principal: Principal,
    documentId: string,
    controlId: string,
    note: string | null,
  ): Promise<{ id: string }> {
    const [doc, control] = await Promise.all([
      this.prisma.document.findUnique({ where: { id: documentId }, select: { id: true } }),
      this.prisma.control.findUnique({ where: { id: controlId }, select: { id: true } }),
    ])
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan.')
    if (!control) throw new NotFoundException('Kontrol tidak ditemukan.')

    const existing = await this.prisma.documentControlLink.findFirst({
      where: { documentId, controlId },
      select: { id: true },
    })
    if (existing) throw new ConflictException('Dokumen ini sudah tertaut ke kontrol tersebut.')

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.documentControlLink.create({
        data: { id, documentId, controlId, note, linkedBy: principal.userId },
      })
      await audit.record({
        action: 'TAUTKAN_DOKUMEN_KONTROL',
        objectType: 'DOCUMENT',
        objectId: documentId,
        after: { control_id: controlId },
      })
    })
    return { id }
  }

  /* ----------------------------------------------------------- internals --- */

  /**
   * Rebuild the search chunks for one version.
   *
   * Delete-then-insert rather than diffing: a version's text is replaced
   * wholesale, and a partial reindex that leaves a stale chunk behind produces
   * a citation pointing at text that no longer exists -- the failure mode
   * FR-C-013 cares most about. Runs inside the caller's transaction, so the
   * index cannot end up describing a version that was rolled back.
   */
  private async reindex(
    tx: TransactionClient,
    versionId: string,
    title: string,
    body: string,
  ): Promise<void> {
    await tx.documentChunk.deleteMany({ where: { documentVersionId: versionId } })
    const chunks = chunkDocument(title, body)
    if (chunks.length === 0) return
    await tx.documentChunk.createMany({
      data: chunks.map((c) => ({
        id: randomUUID(),
        documentVersionId: versionId,
        chunkIndex: c.index,
        sectionRef: c.sectionRef,
        content: c.content,
        tokenCount: c.tokenCount,
      })),
    })
  }

  private async assertOwnersExist(orgUnitId: string, employeeId: string): Promise<void> {
    const [unit, employee] = await Promise.all([
      this.prisma.organizationUnit.findUnique({ where: { id: orgUnitId }, select: { id: true } }),
      this.prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } }),
    ])
    if (!unit) throw new BadRequestException('Unit pemilik tidak ditemukan.')
    if (!employee) throw new BadRequestException('Pemilik dokumen tidak ditemukan.')
  }

  /** FR-C-001 aturan 2 · a higher-standing document may not cite a lower one. */
  private async assertHierarchy(
    type: DocumentType,
    relatedIds: readonly string[],
  ): Promise<void> {
    if (relatedIds.length === 0) return
    const related = await this.prisma.document.findMany({
      where: { id: { in: [...relatedIds] } },
      select: { id: true, documentType: true, title: true },
    })
    for (const r of related) {
      if (!mayReference(type, r.documentType)) {
        throw new BadRequestException(
          `Dokumen jenis ${type} tidak boleh merujuk dokumen jenis ${r.documentType} ("${r.title}"). ` +
            'Hierarki normatif hanya berlaku satu arah (FR-C-001 aturan 2).',
        )
      }
    }
  }
}

/** The UTC calendar date of an instant, at midnight UTC. */
function toUtcDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}
