import { randomUUID } from 'node:crypto'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { RequestItemStatus } from '@prisma/client'
import { UnitOfWork, hasAnyRole, PrismaService, type Principal } from '../shared/index.js'

export interface RequestItemInput {
  readonly description: string
  readonly controlId?: string
  readonly evidencePeriodFrom?: Date
  readonly evidencePeriodTo?: Date
  readonly responsibleOrgUnitId?: string
  readonly picEmployeeId: string
  readonly dueDate: Date
  readonly expectedEvidenceType?: string
  readonly isMandatory: boolean
}

export type ReviewDecision = 'TERIMA' | 'TOLAK' | 'MINTA_INFO_TAMBAHAN'

/**
 * FR-A-006 s.d. FR-A-009 · evidence requests (PBC) and their lifecycle.
 *
 * The lifecycle mirrors FR-A-007's diagram, and two of its rules are the reason
 * this is a service and not CRUD:
 *
 * - A DRAF request is invisible to the PIC (FR-A-006 rule 4). "My tasks"
 *   (FR-A-009) therefore filters to published-or-later, so a request the auditor
 *   is still drafting never appears on someone's worklist.
 * - Only AUDITOR_INT/AUDIT_LEAD can move a request to SELESAI (FR-A-007 rule 1),
 *   and a rejection needs a reason of at least 20 characters (rule 2).
 */
const TRANSITIONS: Readonly<Record<RequestItemStatus, readonly RequestItemStatus[]>> = {
  DRAF: ['TERBIT', 'TIDAK_BERLAKU'],
  TERBIT: ['DISERAHKAN', 'TIDAK_BERLAKU'],
  DISERAHKAN: ['DALAM_PENELAAHAN'],
  DALAM_PENELAAHAN: ['SELESAI', 'TERBIT', 'INFO_TAMBAHAN'],
  INFO_TAMBAHAN: ['DISERAHKAN'],
  SELESAI: [],
  TIDAK_BERLAKU: [],
}

@Injectable()
export class RequestItemService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /** FR-A-006 · the requests within one engagement (auditor view: all states). */
  async listForEngagement(_principal: Principal, engagementId: string) {
    const items = await this.prisma.requestItem.findMany({
      where: { engagementId },
      include: {
        control: { select: { id: true, code: true } },
        picEmployee: { select: { id: true, fullName: true, employeeNumber: true } },
      },
      orderBy: [{ sequenceNo: 'asc' }],
    })
    return items.map((i) => this.present(i))
  }

  /** FR-A-006 · create a request in DRAF, next sequence number in the engagement. */
  async create(
    principal: Principal,
    engagementId: string,
    input: RequestItemInput,
  ): Promise<{ id: string; sequenceNo: number }> {
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true, fieldworkEnd: true, status: true },
    })
    if (!engagement) throw new NotFoundException('Penugasan tidak ditemukan.')

    // FR-A-006 rule 3: due date cannot pass the engagement's fieldwork end.
    if (engagement.fieldworkEnd && input.dueDate > engagement.fieldworkEnd) {
      throw new BadRequestException(
        'Tenggat permintaan tidak boleh melewati tanggal selesai lapangan penugasan.',
      )
    }
    // FR-A-006 Validasi: the PIC must be an active employee.
    await this.requireActivePic(input.picEmployeeId)

    const last = await this.prisma.requestItem.findFirst({
      where: { engagementId },
      orderBy: { sequenceNo: 'desc' },
      select: { sequenceNo: true },
    })
    const sequenceNo = (last?.sequenceNo ?? 0) + 1
    const id = randomUUID()

    await this.uow.write(async (tx, audit) => {
      await tx.requestItem.create({
        data: {
          id,
          engagementId,
          sequenceNo,
          description: input.description,
          controlId: input.controlId ?? null,
          evidencePeriodFrom: input.evidencePeriodFrom ?? null,
          evidencePeriodTo: input.evidencePeriodTo ?? null,
          responsibleOrgUnitId: input.responsibleOrgUnitId ?? null,
          picEmployeeId: input.picEmployeeId,
          dueDate: input.dueDate,
          expectedEvidenceType: input.expectedEvidenceType ?? null,
          isMandatory: input.isMandatory,
          status: 'DRAF',
        },
      })
      await audit.record({
        action: 'BUAT_PERMINTAAN_BUKTI',
        objectType: 'REQUEST_ITEM',
        objectId: id,
        after: { engagement_id: engagementId, sequence_no: sequenceNo },
      })
    })
    return { id, sequenceNo }
  }

  /** FR-A-006 rule 1 · publish every DRAF request in an engagement at once. */
  async publish(_principal: Principal, engagementId: string): Promise<{ published: number }> {
    const drafts = await this.prisma.requestItem.findMany({
      where: { engagementId, status: 'DRAF' },
      select: { id: true, sequenceNo: true },
    })
    if (drafts.length === 0) {
      throw new ConflictException('Tidak ada permintaan berstatus DRAF untuk diterbitkan.')
    }
    await this.uow.write(async (tx, audit) => {
      await tx.requestItem.updateMany({
        where: { engagementId, status: 'DRAF' },
        data: { status: 'TERBIT' },
      })
      await audit.record({
        action: 'TERBITKAN_PERMINTAAN_BUKTI',
        objectType: 'ENGAGEMENT',
        objectId: engagementId,
        after: { published: drafts.length },
      })
    })
    return { published: drafts.length }
  }

  /**
   * FR-A-009 · the PIC's unified task list across every active engagement.
   *
   * DRAF requests are excluded (FR-A-006 rule 4): a request still being drafted
   * is not yet the PIC's problem. Overdue items sort to the top with a clear
   * urgency flag (FR-A-009 aturan).
   */
  async myTasks(principal: Principal) {
    if (!principal.employeeId) return []
    const items = await this.prisma.requestItem.findMany({
      where: {
        picEmployeeId: principal.employeeId,
        status: { in: ['TERBIT', 'DISERAHKAN', 'DALAM_PENELAAHAN', 'INFO_TAMBAHAN'] },
      },
      include: { engagement: { select: { id: true, code: true, title: true } } },
      orderBy: [{ dueDate: 'asc' }],
    })

    const today = Date.now()
    return items.map((i) => {
      const daysRemaining = Math.ceil((i.dueDate.getTime() - today) / 86_400_000)
      const urgency = daysRemaining < 0 ? 'TERLEWAT' : daysRemaining <= 3 ? 'MENDESAK' : 'NORMAL'
      return {
        id: i.id,
        engagement: {
          id: i.engagement.id,
          code: i.engagement.code,
          title: i.engagement.title,
        },
        sequence_no: i.sequenceNo,
        description: i.description,
        due_date: i.dueDate.toISOString().slice(0, 10),
        days_remaining: daysRemaining,
        urgency,
        status: i.status,
        is_mandatory: i.isMandatory,
      }
    })
  }

  /** FR-A-007 · PIC submits, moving TERBIT/INFO_TAMBAHAN -> DISERAHKAN. */
  async submit(principal: Principal, id: string): Promise<void> {
    const item = await this.requireItem(id)
    if (principal.employeeId !== item.picEmployeeId) {
      throw new ForbiddenException('Hanya PIC permintaan ini yang dapat menyerahkan bukti.')
    }
    await this.move(id, item.status, 'DISERAHKAN', 'SERAHKAN_PERMINTAAN_BUKTI', {})
  }

  /**
   * FR-A-007 rule 1, 2 · auditor review.
   *
   * TERIMA moves DALAM_PENELAAHAN -> SELESAI; TOLAK returns it to TERBIT;
   * MINTA_INFO_TAMBAHAN parks it at INFO_TAMBAHAN. Only AUDITOR_INT/AUDIT_LEAD
   * may review, and a rejection or info request needs a 20-character reason.
   */
  async review(
    principal: Principal,
    id: string,
    decision: ReviewDecision,
    reason: string | undefined,
  ): Promise<void> {
    if (!hasAnyRole(principal, 'AUDITOR_INT', 'AUDIT_LEAD')) {
      throw new ForbiddenException('Hanya AUDITOR_INT atau AUDIT_LEAD yang dapat menelaah permintaan.')
    }
    const item = await this.requireItem(id)
    // Reviewing implies the auditor has started; accept from DISERAHKAN too by
    // first advancing to DALAM_PENELAAHAN.
    let status = item.status
    if (status === 'DISERAHKAN') {
      await this.move(id, status, 'DALAM_PENELAAHAN', 'MULAI_TELAAH_PERMINTAAN_BUKTI', {})
      status = 'DALAM_PENELAAHAN'
    }
    if (status !== 'DALAM_PENELAAHAN') {
      throw new ConflictException(
        `Hanya permintaan berstatus DISERAHKAN atau DALAM_PENELAAHAN yang dapat ditelaah; ini ${status}.`,
      )
    }

    if (decision === 'TERIMA') {
      await this.move(id, status, 'SELESAI', 'TERIMA_PERMINTAAN_BUKTI', {})
      return
    }
    if (!reason || reason.trim().length < 20) {
      throw new BadRequestException('Penolakan atau permintaan info tambahan memerlukan alasan minimal 20 karakter.')
    }
    const target: RequestItemStatus = decision === 'TOLAK' ? 'TERBIT' : 'INFO_TAMBAHAN'
    const action = decision === 'TOLAK' ? 'TOLAK_PERMINTAAN_BUKTI' : 'MINTA_INFO_PERMINTAAN_BUKTI'
    await this.move(id, status, target, action, { reason }, reason)
  }

  /** FR-A-005 rule 1 support · mark a request not applicable, with a reason. */
  async markNotApplicable(principal: Principal, id: string, reason: string): Promise<void> {
    if (!hasAnyRole(principal, 'AUDITOR_INT', 'AUDIT_LEAD')) {
      throw new ForbiddenException('Hanya AUDITOR_INT atau AUDIT_LEAD yang dapat menandai tidak berlaku.')
    }
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Menandai tidak berlaku memerlukan alasan minimal 10 karakter.')
    }
    const item = await this.requireItem(id)
    await this.move(id, item.status, 'TIDAK_BERLAKU', 'TANDAI_TIDAK_BERLAKU', { reason }, reason)
  }

  private async move(
    id: string,
    from: RequestItemStatus,
    to: RequestItemStatus,
    action: string,
    detail: Record<string, unknown>,
    reviewNote?: string,
  ): Promise<void> {
    if (!TRANSITIONS[from].includes(to)) {
      throw new ConflictException(`Permintaan berstatus ${from} tidak dapat berpindah ke ${to}.`)
    }
    await this.uow.write(async (tx, audit) => {
      await tx.requestItem.update({
        where: { id },
        data: { status: to, ...(reviewNote !== undefined ? { reviewNote } : {}) },
      })
      await audit.record({
        action,
        objectType: 'REQUEST_ITEM',
        objectId: id,
        before: { status: from },
        after: { status: to, ...detail },
      })
    })
  }

  private async requireItem(id: string) {
    const item = await this.prisma.requestItem.findUnique({
      where: { id },
      select: { id: true, status: true, picEmployeeId: true },
    })
    if (!item) throw new NotFoundException('Permintaan bukti tidak ditemukan.')
    return item
  }

  private async requireActivePic(employeeId: string): Promise<void> {
    const pic = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employmentStatus: true },
    })
    if (!pic) throw new BadRequestException('PIC tidak dikenal.')
    if (pic.employmentStatus !== 'AKTIF') throw new BadRequestException('PIC harus karyawan aktif.')
  }

  private present(i: {
    id: string
    sequenceNo: number
    description: string
    dueDate: Date
    status: RequestItemStatus
    isMandatory: boolean
    expectedEvidenceType: string | null
    control: { id: string; code: string } | null
    picEmployee: { id: string; fullName: string; employeeNumber: string }
  }) {
    return {
      id: i.id,
      sequence_no: i.sequenceNo,
      description: i.description,
      due_date: i.dueDate.toISOString().slice(0, 10),
      status: i.status,
      is_mandatory: i.isMandatory,
      expected_evidence_type: i.expectedEvidenceType,
      control: i.control ? { id: i.control.id, code: i.control.code } : null,
      pic: {
        id: i.picEmployee.id,
        full_name: i.picEmployee.fullName,
        employee_number: i.picEmployee.employeeNumber,
      },
    }
  }
}
