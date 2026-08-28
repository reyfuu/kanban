import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { ApprovalStepKind } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal, type TransactionClient } from '../shared/index.js'

/**
 * FR-C-005 · the staged review and ratification flow.
 *
 * Four properties, each of which is the reason a step exists at all:
 *
 * - **Reviewers in parallel, approvers in sequence** (aturan 1 & 2). A review
 *   gathers opinions and gathering them at once loses nothing. Ratification is
 *   a chain of authority, and letting a higher tier sign before a lower one
 *   inverts the hierarchy the signature is meant to represent. So a review step
 *   opens as soon as the stage does, while an approval step stays MENUNGGU and
 *   unactionable until every lower-numbered approval is SETUJU.
 *
 * - **Every decision carries a comment; a rejection carries a reason**
 *   (aturan 3). Checked here for a readable message, and again by a CHECK
 *   constraint in the database so no other write path can bypass it.
 *
 * - **Ratification requires re-authentication** (aturan 4, FR-X-003). Enforced
 *   by @RequiresStepUp() on the route, before this service is reached.
 *
 * - **An inactive assignee redirects to their delegate or manager** (aturan 5).
 *   The redirect is recorded rather than applied by overwriting the assignee,
 *   so the trail shows both who was supposed to act and who actually did. A
 *   flow that silently reassigns is a flow whose approval record is a guess.
 *
 * Aturan 6 -- the author may cancel the flow while it has not entered
 * ratification -- is `cancel()` below, and it refuses once any approval step
 * has been decided.
 */
@Injectable()
export class DocumentApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * Start the flow for a version: copy the applicable template into concrete
   * steps and move the document into DALAM_PENELAAHAN.
   *
   * The template is resolved most-specific-first: a template for this document
   * type AND this org unit wins over the company-wide one for the type. If no
   * template exists at all, the flow is refused rather than being invented --
   * a document that reaches "Disahkan" through a ladder nobody configured has
   * not actually been approved by anyone.
   */
  async submit(
    principal: Principal,
    documentId: string,
    options: { isMinor?: boolean } = {},
  ): Promise<{ steps: number }> {
    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        status: true,
        documentType: true,
        ownerOrgUnitId: true,
        ownerEmployeeId: true,
      },
    })
    if (!doc) throw new NotFoundException('Dokumen tidak ditemukan.')
    if (doc.status !== 'DRAF' && doc.status !== 'DALAM_REVISI') {
      throw new ConflictException(
        'Hanya dokumen berstatus Draf atau Dalam Revisi yang dapat diajukan untuk ditelaah.',
      )
    }

    const version = await this.workingVersion(documentId)
    if (!version) throw new ConflictException('Dokumen tidak memiliki versi kerja.')

    const existing = await this.prisma.documentApprovalStep.count({
      where: { documentVersionId: version.id, status: 'MENUNGGU' },
    })
    if (existing > 0) {
      throw new ConflictException('Alur persetujuan untuk versi ini sudah berjalan.')
    }

    // A rejected or cancelled flow keeps its steps, so resubmission opens a new
    // round rather than reusing the slots. Deleting the old rows instead would
    // erase the record of the rejection -- and "why was this returned the first
    // time" is the first question asked about a document ratified on attempt
    // three.
    const previous = await this.prisma.documentApprovalStep.aggregate({
      where: { documentVersionId: version.id },
      _max: { round: true },
    })
    const round = (previous._max.round ?? 0) + 1

    const templates = await this.resolveTemplates(doc.documentType, doc.ownerOrgUnitId)
    if (templates.length === 0) {
      throw new ConflictException(
        `Belum ada templat alur persetujuan untuk jenis ${doc.documentType}. ` +
          'Konfigurasikan templatnya terlebih dahulu — dokumen tidak dapat disahkan lewat alur yang belum ditetapkan.',
      )
    }

    // FR-C-006 aturan 2 · an editorial revision may skip the steps the template
    // marks as skippable. Skipped steps are still written, as DILEWATI, so the
    // record shows the tier was passed over deliberately rather than omitted.
    const isMinor = options.isMinor === true

    const resolved: {
      kind: ApprovalStepKind
      stepOrder: number
      assigneeEmployeeId: string
      skipped: boolean
    }[] = []

    for (const t of templates) {
      const assigneeId = t.employeeId ?? (await this.firstHolderOfRole(t.roleCode!))
      if (!assigneeId) {
        throw new ConflictException(
          `Templat alur menunjuk peran ${t.roleCode}, tetapi tidak ada karyawan aktif yang memegangnya.`,
        )
      }
      resolved.push({
        kind: t.kind,
        stepOrder: t.stepOrder,
        assigneeEmployeeId: assigneeId,
        skipped: isMinor && t.skipOnMinor,
      })
    }

    if (resolved.every((r) => r.skipped)) {
      throw new ConflictException(
        'Seluruh langkah dilewati untuk perubahan minor; alur ini tidak akan pernah disahkan siapa pun.',
      )
    }

    await this.uow.write(async (tx, audit) => {
      for (const step of resolved) {
        await tx.documentApprovalStep.create({
          data: {
            id: randomUUID(),
            documentVersionId: version.id,
            round,
            kind: step.kind,
            stepOrder: step.stepOrder,
            assigneeEmployeeId: step.assigneeEmployeeId,
            status: step.skipped ? 'DILEWATI' : 'MENUNGGU',
          },
        })
      }
      await tx.document.update({
        where: { id: documentId },
        data: { status: 'DALAM_PENELAAHAN' },
      })
      await tx.documentVersion.update({
        where: { id: version.id },
        data: { status: 'DALAM_PENELAAHAN' },
      })
      await audit.record({
        action: 'AJUKAN_TELAAH_DOKUMEN',
        objectType: 'DOCUMENT',
        objectId: documentId,
        after: {
          version_id: version.id,
          round,
          steps: resolved.length,
          skipped: resolved.filter((r) => r.skipped).length,
          minor: isMinor,
        },
      })
    })

    return { steps: resolved.filter((r) => !r.skipped).length }
  }

  /**
   * Act on one step: approve, return to the author, or reject.
   *
   * Whether the caller may act is decided here, not by the route's permission
   * alone: holding `document:approve` makes someone an approver in general, but
   * only being the assignee (or their delegate/manager under aturan 5) makes
   * them the approver of THIS step. A permission check without an assignee
   * check would let any approver sign any document, which defeats the ladder.
   */
  async act(
    principal: Principal,
    stepId: string,
    decision: 'SETUJU' | 'DIKEMBALIKAN' | 'DITOLAK',
    comment: string,
  ): Promise<void> {
    if (!comment.trim()) {
      throw new BadRequestException('Setiap keputusan wajib memuat komentar (FR-C-005 aturan 3).')
    }
    if (decision !== 'SETUJU' && comment.trim().length < 10) {
      throw new BadRequestException('Penolakan dan pengembalian wajib disertai alasan yang jelas.')
    }

    const step = await this.prisma.documentApprovalStep.findUnique({
      where: { id: stepId },
      select: {
        id: true,
        kind: true,
        stepOrder: true,
        round: true,
        status: true,
        assigneeEmployeeId: true,
        documentVersionId: true,
        version: { select: { id: true, documentId: true } },
      },
    })
    // 404 rather than 403: the step belongs to a document whose existence may
    // itself be confidential (kode aturan #3).
    if (!step) throw new NotFoundException('Langkah persetujuan tidak ditemukan.')
    if (step.status !== 'MENUNGGU') {
      throw new ConflictException('Langkah ini sudah diputuskan.')
    }

    const authority = await this.authorityOver(principal, step.assigneeEmployeeId)
    if (!authority.allowed) {
      throw new ForbiddenException('Langkah ini bukan tugas Anda.')
    }

    // FR-C-005 aturan 2 · an approval step is unactionable until every
    // lower-numbered approval is done. Checked at act time rather than only at
    // display time, because a hidden button is not a control.
    if (step.kind === 'PENGESAHAN') {
      // Reviews are checked FIRST. Both conditions block the same action, but
      // the reviewer stage is the earlier one, and reporting the later
      // violation ("langkah sebelumnya belum selesai") when the real blocker is
      // an unfinished review sends the approver chasing the wrong person.
      const openReviews = await this.prisma.documentApprovalStep.count({
        where: {
          documentVersionId: step.documentVersionId,
          round: step.round,
          kind: 'PENELAAHAN',
          status: 'MENUNGGU',
        },
      })
      if (openReviews > 0) {
        throw new ConflictException('Penelaahan belum selesai; pengesahan belum dapat dilakukan.')
      }

      const blocking = await this.prisma.documentApprovalStep.count({
        where: {
          documentVersionId: step.documentVersionId,
          round: step.round,
          kind: 'PENGESAHAN',
          stepOrder: { lt: step.stepOrder },
          status: { notIn: ['SETUJU', 'DILEWATI'] },
        },
      })
      if (blocking > 0) {
        throw new ConflictException(
          'Pengesahan berjenjang: langkah sebelumnya belum selesai.',
        )
      }
    }

    await this.uow.write(async (tx, audit) => {
      await tx.documentApprovalStep.update({
        where: { id: stepId },
        data: {
          status: decision,
          comment: comment.trim(),
          actedBy: principal.userId,
          actedAt: new Date(),
          ...(authority.redirectedFrom
            ? {
                redirectedFromEmployeeId: authority.redirectedFrom,
                redirectReason: authority.reason,
              }
            : {}),
        },
      })

      await this.advance(tx, step.version.documentId, step.documentVersionId, step.round, decision)

      await audit.record({
        action:
          decision === 'SETUJU'
            ? step.kind === 'PENGESAHAN'
              ? 'SAHKAN_DOKUMEN'
              : 'SETUJUI_TELAAH_DOKUMEN'
            : decision === 'DITOLAK'
              ? 'TOLAK_DOKUMEN'
              : 'KEMBALIKAN_DOKUMEN',
        objectType: 'DOCUMENT',
        objectId: step.version.documentId,
        after: {
          step_id: stepId,
          kind: step.kind,
          step_order: step.stepOrder,
          round: step.round,
          decision,
          comment: comment.trim(),
          ...(authority.redirectedFrom ? { redirected_from: authority.redirectedFrom } : {}),
        },
      })
    })
  }

  /**
   * FR-C-005 aturan 6 · the author stops the flow.
   *
   * Refused once ratification has begun. An approver's signature is not
   * something the author gets to withdraw: by then the way back is a rejection
   * or a new version, both of which leave a record.
   */
  async cancel(principal: Principal, documentId: string, reason: string): Promise<void> {
    if (reason.trim().length < 10) {
      throw new BadRequestException('Penghentian alur wajib disertai alasan.')
    }
    const version = await this.workingVersion(documentId)
    if (!version) throw new NotFoundException('Dokumen tidak memiliki versi kerja.')

    const live = await this.prisma.documentApprovalStep.aggregate({
      where: { documentVersionId: version.id },
      _max: { round: true },
    })
    const round = live._max.round ?? 1

    const ratified = await this.prisma.documentApprovalStep.count({
      where: {
        documentVersionId: version.id,
        round,
        kind: 'PENGESAHAN',
        status: { in: ['SETUJU', 'DITOLAK'] },
      },
    })
    if (ratified > 0) {
      throw new ConflictException(
        'Alur sudah masuk tahap pengesahan dan tidak dapat dihentikan penyusun.',
      )
    }

    await this.uow.write(async (tx, audit) => {
      await tx.documentApprovalStep.updateMany({
        where: { documentVersionId: version.id, round, status: 'MENUNGGU' },
        data: { status: 'DIBATALKAN' },
      })
      await tx.document.update({ where: { id: documentId }, data: { status: 'DRAF' } })
      await tx.documentVersion.update({ where: { id: version.id }, data: { status: 'DRAF' } })
      await audit.record({
        action: 'HENTIKAN_ALUR_DOKUMEN',
        objectType: 'DOCUMENT',
        objectId: documentId,
        after: { reason: reason.trim() },
      })
    })
  }

  /** The steps still waiting on the signed-in person -- their approval queue. */
  async myQueue(principal: Principal) {
    if (!principal.employeeId) return []
    // Under aturan 5 a delegate also carries the steps of whoever delegated to
    // them, so the queue is keyed on every employee this person may act for.
    const actingFor = await this.employeesIActFor(principal)
    return this.prisma.documentApprovalStep.findMany({
      where: { status: 'MENUNGGU', assigneeEmployeeId: { in: actingFor } },
      select: {
        id: true,
        kind: true,
        stepOrder: true,
        assigneeEmployeeId: true,
        version: {
          select: {
            id: true,
            versionMajor: true,
            versionMinor: true,
            changeSummary: true,
            document: {
              select: { id: true, documentNo: true, title: true, documentType: true, classification: true },
            },
          },
        },
      },
      orderBy: [{ kind: 'asc' }, { stepOrder: 'asc' }],
      take: 200,
    })
  }

  /** Every step on a version, for the document detail page. */
  async stepsFor(documentVersionId: string) {
    return this.prisma.documentApprovalStep.findMany({
      where: { documentVersionId },
      select: {
        id: true,
        kind: true,
        stepOrder: true,
        status: true,
        comment: true,
        actedAt: true,
        assignee: { select: { fullName: true, jobTitle: true } },
        redirectedFrom: { select: { fullName: true } },
        redirectReason: true,
      },
      orderBy: [{ kind: 'asc' }, { stepOrder: 'asc' }],
    })
  }

  /* ----------------------------------------------------------- internals --- */

  /**
   * Move the document's status after a step decision.
   *
   * A rejection or a return sends the whole version back to DRAF and cancels
   * the outstanding steps: the author has to resubmit, which restarts the
   * ladder from the top. That is deliberate. Resuming a flow mid-way after the
   * text changed would mean the earlier approvers signed a document that no
   * longer exists.
   */
  private async advance(
    tx: TransactionClient,
    documentId: string,
    versionId: string,
    round: number,
    decision: 'SETUJU' | 'DIKEMBALIKAN' | 'DITOLAK',
  ): Promise<void> {
    if (decision !== 'SETUJU') {
      await tx.documentApprovalStep.updateMany({
        where: { documentVersionId: versionId, round, status: 'MENUNGGU' },
        data: { status: 'DIBATALKAN' },
      })
      await tx.document.update({ where: { id: documentId }, data: { status: 'DRAF' } })
      await tx.documentVersion.update({ where: { id: versionId }, data: { status: 'DRAF' } })
      return
    }

    const remaining = await tx.documentApprovalStep.groupBy({
      by: ['kind'],
      where: { documentVersionId: versionId, round, status: 'MENUNGGU' },
      _count: { _all: true },
    })
    const pendingReviews = remaining.find((r) => r.kind === 'PENELAAHAN')?._count._all ?? 0
    const pendingApprovals = remaining.find((r) => r.kind === 'PENGESAHAN')?._count._all ?? 0

    if (pendingReviews === 0 && pendingApprovals === 0) {
      // FR-C-004: every approver agreed. The document is ratified, not yet in
      // force -- taking force is a separate, dated act (FR-C-007).
      await tx.document.update({ where: { id: documentId }, data: { status: 'DISAHKAN' } })
      await tx.documentVersion.update({
        where: { id: versionId },
        data: { status: 'DISAHKAN', approvedAt: new Date() },
      })
      return
    }

    const next = pendingReviews > 0 ? 'DALAM_PENELAAHAN' : 'MENUNGGU_PENGESAHAN'
    await tx.document.update({ where: { id: documentId }, data: { status: next } })
    await tx.documentVersion.update({ where: { id: versionId }, data: { status: next } })
  }

  /** The version the flow acts on: the newest one not yet in force. */
  private async workingVersion(documentId: string) {
    return this.prisma.documentVersion.findFirst({
      where: {
        documentId,
        status: { in: ['DRAF', 'DALAM_PENELAAHAN', 'MENUNGGU_PENGESAHAN', 'DALAM_REVISI'] },
      },
      orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
      select: { id: true, versionMajor: true, versionMinor: true },
    })
  }

  /** Most-specific-first: a unit template beats the company-wide one. */
  private async resolveTemplates(documentType: string, orgUnitId: string) {
    const unitSpecific = await this.prisma.documentApprovalTemplate.findMany({
      where: { documentType: documentType as never, orgUnitId, isActive: true },
      orderBy: [{ kind: 'asc' }, { stepOrder: 'asc' }],
    })
    if (unitSpecific.length > 0) return unitSpecific
    return this.prisma.documentApprovalTemplate.findMany({
      where: { documentType: documentType as never, orgUnitId: null, isActive: true },
      orderBy: [{ kind: 'asc' }, { stepOrder: 'asc' }],
    })
  }

  private async firstHolderOfRole(roleCode: string): Promise<string | null> {
    const holder = await this.prisma.userRole.findFirst({
      where: {
        role: { code: roleCode },
        OR: [{ validUntil: null }, { validUntil: { gte: new Date() } }],
        user: { isActive: true, employee: { employmentStatus: 'AKTIF' } },
      },
      select: { user: { select: { employeeId: true } } },
      orderBy: { createdAt: 'asc' },
    })
    return holder?.user.employeeId ?? null
  }

  /**
   * FR-C-005 aturan 5 · may this principal act on a step assigned to
   * `assigneeEmployeeId`?
   *
   * Three ways yes: they ARE the assignee; the assignee is inactive and this
   * person holds an active delegation from them; or the assignee is inactive
   * and this person is their manager. The redirect only opens when the assignee
   * is genuinely unavailable -- a delegation is not a licence to take over work
   * its holder is still doing.
   */
  private async authorityOver(
    principal: Principal,
    assigneeEmployeeId: string,
  ): Promise<{ allowed: boolean; redirectedFrom?: string; reason?: string }> {
    if (!principal.employeeId) return { allowed: false }
    if (principal.employeeId === assigneeEmployeeId) return { allowed: true }

    const assignee = await this.prisma.employee.findUnique({
      where: { id: assigneeEmployeeId },
      select: {
        id: true,
        employmentStatus: true,
        managerId: true,
        appUser: { select: { id: true, isActive: true } },
      },
    })
    if (!assignee) return { allowed: false }

    const assigneeAvailable =
      assignee.employmentStatus === 'AKTIF' && assignee.appUser?.isActive === true
    if (assigneeAvailable) return { allowed: false }

    const delegation = assignee.appUser
      ? await this.prisma.delegation.findFirst({
          where: {
            fromUserId: assignee.appUser.id,
            toUserId: principal.userId,
            isActive: true,
            validFrom: { lte: new Date() },
            validUntil: { gte: new Date() },
          },
          select: { id: true },
        })
      : null

    if (delegation) {
      return {
        allowed: true,
        redirectedFrom: assigneeEmployeeId,
        reason: 'Penerima delegasi; penerima tugas asli tidak aktif.',
      }
    }

    if (assignee.managerId === principal.employeeId) {
      return {
        allowed: true,
        redirectedFrom: assigneeEmployeeId,
        reason: 'Atasan langsung; penerima tugas asli tidak aktif.',
      }
    }

    return { allowed: false }
  }

  /** Employee ids this principal may act for: themselves, plus delegators. */
  private async employeesIActFor(principal: Principal): Promise<string[]> {
    const ids = new Set<string>()
    if (principal.employeeId) ids.add(principal.employeeId)

    const delegations = await this.prisma.delegation.findMany({
      where: {
        toUserId: principal.userId,
        isActive: true,
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
      select: { fromUser: { select: { employeeId: true } } },
    })
    for (const d of delegations) {
      if (d.fromUser.employeeId) ids.add(d.fromUser.employeeId)
    }
    return [...ids]
  }
}
