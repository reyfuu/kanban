import { randomUUID } from 'node:crypto'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { EngagementStatus, EngagementType, Prisma } from '@prisma/client'
import { PrismaService, UnitOfWork, hasAnyRole, type Principal } from '../shared/index.js'

export interface EngagementInput {
  readonly title: string
  readonly engagementType: EngagementType
  readonly periodFrom: Date
  readonly periodTo: Date
  readonly fieldworkStart?: Date
  readonly fieldworkEnd?: Date
  readonly leadAuditorId: string
  readonly teamMemberIds: readonly string[]
  readonly controlIds: readonly string[]
}

export interface EngagementListFilter {
  readonly status?: EngagementStatus
  readonly engagementType?: EngagementType
  readonly year?: number
  readonly take: number
}

/**
 * Roles with firm-wide visibility over engagements (FR-A-004 rule 3): they see
 * every engagement, not only the ones they are a member of.
 */
const FIRM_WIDE_ROLES = ['AUDIT_LEAD', 'COMPLIANCE'] as const

/**
 * FR-A-005 · the engagement lifecycle, as an allowed-transition table.
 *
 * The state machine is the contract (07-API-CONTRACT Sec 4.3): an unlisted
 * transition is a 409, not a silent no-op. Two transitions carry extra rules
 * enforced in `transition` rather than here, because they depend on data the
 * table cannot see:
 *
 * - -> PELAPORAN requires every request item resolved (rule 1).
 * - -> DIBATALKAN requires a reason and AUDIT_LEAD (rule 3).
 *
 * SELESAI can fork to PEMANTAUAN (open findings remain) or straight to DITUTUP
 * (none), which the diagram in FR-A-005 shows and the service decides from the
 * findings, not from the caller.
 */
const TRANSITIONS: Readonly<Record<EngagementStatus, readonly EngagementStatus[]>> = {
  PERENCANAAN: ['BERJALAN', 'DIBATALKAN'],
  BERJALAN: ['PELAPORAN', 'DITANGGUHKAN'],
  PELAPORAN: ['SELESAI'],
  SELESAI: ['PEMANTAUAN', 'DITUTUP'],
  PEMANTAUAN: ['DITUTUP'],
  DITANGGUHKAN: ['BERJALAN', 'DIBATALKAN'],
  DITUTUP: [],
  DIBATALKAN: [],
}

@Injectable()
export class EngagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * FR-A-004 rule 3 · the engagements a principal may see.
   *
   * AUDIT_LEAD and COMPLIANCE see all; everyone else sees only engagements they
   * lead or are a member of. The membership filter is applied in the query, not
   * the controller, so a later caller over the same repository cannot forget it.
   */
  async list(principal: Principal, filter: EngagementListFilter) {
    const visibility = this.visibilityWhere(principal)
    const engagements = await this.prisma.engagement.findMany({
      where: {
        AND: [
          visibility,
          filter.status ? { status: filter.status } : {},
          filter.engagementType ? { engagementType: filter.engagementType } : {},
          filter.year
            ? {
                periodFrom: { lte: new Date(`${filter.year}-12-31`) },
                periodTo: { gte: new Date(`${filter.year}-01-01`) },
              }
            : {},
        ],
      },
      include: {
        leadAuditor: { select: { id: true, externalId: true } },
        _count: { select: { members: true, controls: true, requestItems: true, findings: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: filter.take,
    })
    return engagements.map((e) => this.presentSummary(e))
  }

  async findOne(principal: Principal, id: string) {
    const engagement = await this.prisma.engagement.findFirst({
      where: { AND: [this.visibilityWhere(principal), { id }] },
      include: {
        leadAuditor: { select: { id: true, externalId: true } },
        members: { include: { user: { select: { id: true, externalId: true } } } },
        controls: { include: { control: { select: { id: true, code: true, title: true } } } },
        _count: { select: { requestItems: true, findings: true } },
      },
    })
    // 404 rather than 403 for an engagement outside the principal's visibility:
    // its existence is not something a non-member is entitled to learn.
    if (!engagement) throw new NotFoundException('Penugasan tidak ditemukan.')
    return {
      ...this.presentSummary(engagement),
      members: engagement.members.map((m) => ({ id: m.user.id, external_id: m.user.externalId })),
      controls: engagement.controls.map((c) => ({
        id: c.control.id,
        code: c.control.code,
        title: c.control.title,
      })),
    }
  }

  /** FR-A-004 · create an engagement; code is generated <TYPE>-<YEAR>-<seq>. */
  async create(principal: Principal, input: EngagementInput): Promise<{ id: string; code: string }> {
    if (input.periodTo < input.periodFrom) {
      throw new BadRequestException('Periode selesai tidak boleh sebelum periode mulai.')
    }
    await this.requireActiveUser(input.leadAuditorId, 'Ketua tim')
    for (const memberId of input.teamMemberIds) {
      await this.requireActiveUser(memberId, 'Anggota tim')
    }
    await this.requireControlsExist(input.controlIds)

    const code = await this.nextCode(input.engagementType, input.periodFrom.getUTCFullYear())
    const id = randomUUID()

    await this.uow.write(async (tx, audit) => {
      await tx.engagement.create({
        data: {
          id,
          code,
          title: input.title,
          engagementType: input.engagementType,
          periodFrom: input.periodFrom,
          periodTo: input.periodTo,
          fieldworkStart: input.fieldworkStart ?? null,
          fieldworkEnd: input.fieldworkEnd ?? null,
          leadAuditorId: input.leadAuditorId,
          status: 'PERENCANAAN',
        },
      })
      // The lead is always a member, so visibility filtering treats them
      // uniformly with the rest of the team.
      const memberIds = new Set<string>([input.leadAuditorId, ...input.teamMemberIds])
      for (const userId of memberIds) {
        await tx.engagementMember.create({ data: { id: randomUUID(), engagementId: id, userId } })
      }
      for (const controlId of new Set(input.controlIds)) {
        await tx.engagementControl.create({ data: { id: randomUUID(), engagementId: id, controlId } })
      }
      await audit.record({
        action: 'BUAT_PENUGASAN',
        objectType: 'ENGAGEMENT',
        objectId: id,
        after: { code, title: input.title, type: input.engagementType },
      })
    })
    return { id, code }
  }

  /**
   * FR-A-005 · move an engagement through its lifecycle.
   *
   * The transition table guards the shape; the two data-dependent rules are
   * checked here. Returning the blocking items on a refused -> PELAPORAN matches
   * the contract's 409 body, so the auditor sees exactly what is unfinished.
   */
  async transition(
    principal: Principal,
    id: string,
    to: EngagementStatus,
    reason: string | undefined,
  ): Promise<{ status: EngagementStatus }> {
    const engagement = await this.prisma.engagement.findFirst({
      where: { AND: [this.visibilityWhere(principal), { id }] },
      select: { id: true, status: true },
    })
    if (!engagement) throw new NotFoundException('Penugasan tidak ditemukan.')

    if (!TRANSITIONS[engagement.status].includes(to)) {
      throw new ConflictException(
        `Penugasan berstatus ${engagement.status} tidak dapat berpindah ke ${to}.`,
      )
    }

    // Rule 3: cancelling requires a reason and AUDIT_LEAD.
    if (to === 'DIBATALKAN') {
      if (!hasAnyRole(principal, 'AUDIT_LEAD')) {
        throw new ForbiddenException('Pembatalan penugasan memerlukan peran AUDIT_LEAD.')
      }
      if (!reason || reason.trim().length < 10) {
        throw new BadRequestException('Pembatalan penugasan memerlukan alasan minimal 10 karakter.')
      }
    }

    // Rule 1: -> PELAPORAN needs every request item resolved (SELESAI or
    // TIDAK_BERLAKU). A DRAF/TERBIT/etc item blocks the move.
    if (to === 'PELAPORAN') {
      const blocking = await this.prisma.requestItem.findMany({
        where: { engagementId: id, status: { notIn: ['SELESAI', 'TIDAK_BERLAKU'] } },
        select: { id: true, sequenceNo: true, status: true },
        orderBy: { sequenceNo: 'asc' },
      })
      if (blocking.length > 0) {
        throw new ConflictException(
          `Penugasan tidak dapat berpindah ke PELAPORAN karena terdapat ${blocking.length} ` +
            'permintaan bukti yang belum selesai.',
        )
      }
    }

    // SELESAI forks by findings: open findings force PEMANTAUAN rather than
    // DITUTUP, so a closed engagement never hides an unresolved finding.
    const effectiveTo = to
    if (engagement.status === 'SELESAI' && to === 'DITUTUP') {
      const openFindings = await this.prisma.finding.count({
        where: {
          engagementId: id,
          status: { notIn: ['DITUTUP', 'DITERIMA_SEBAGAI_RISIKO', 'DIBATALKAN'] },
        },
      })
      if (openFindings > 0) {
        throw new ConflictException(
          `Penugasan tidak dapat ditutup karena terdapat ${openFindings} temuan yang belum tuntas. ` +
            'Pindahkan ke PEMANTAUAN.',
        )
      }
    }

    await this.uow.write(async (tx, audit) => {
      await tx.engagement.update({
        where: { id },
        data: {
          status: effectiveTo,
          ...(effectiveTo === 'DIBATALKAN' ? { cancelReason: reason ?? null } : {}),
        },
      })
      await audit.record({
        action: 'PINDAH_STATUS_PENUGASAN',
        objectType: 'ENGAGEMENT',
        objectId: id,
        before: { status: engagement.status },
        after: { status: effectiveTo, ...(reason ? { reason } : {}) },
      })
    })
    return { status: effectiveTo }
  }

  /** FR-A-007 rule 4 · readiness = resolved requests / applicable requests. */
  async readiness(principal: Principal, id: string) {
    const engagement = await this.prisma.engagement.findFirst({
      where: { AND: [this.visibilityWhere(principal), { id }] },
      select: { id: true },
    })
    if (!engagement) throw new NotFoundException('Penugasan tidak ditemukan.')

    const items = await this.prisma.requestItem.groupBy({
      by: ['status'],
      where: { engagementId: id },
      _count: true,
    })
    const byStatus: Record<string, number> = {
      DRAF: 0,
      TERBIT: 0,
      DISERAHKAN: 0,
      DALAM_PENELAAHAN: 0,
      INFO_TAMBAHAN: 0,
      SELESAI: 0,
      TIDAK_BERLAKU: 0,
    }
    for (const row of items) byStatus[row.status] = row._count

    const applicable = Object.entries(byStatus)
      .filter(([status]) => status !== 'TIDAK_BERLAKU')
      .reduce((sum, [, count]) => sum + count, 0)
    const readiness = applicable === 0 ? 0 : Math.round((byStatus.SELESAI! / applicable) * 1000) / 10

    const today = new Date()
    const overdue = await this.prisma.requestItem.count({
      where: {
        engagementId: id,
        status: { notIn: ['SELESAI', 'TIDAK_BERLAKU'] },
        dueDate: { lt: today },
      },
    })

    return {
      engagement_id: id,
      by_status: byStatus,
      readiness_percentage: readiness,
      overdue_count: overdue,
    }
  }

  /** FR-A-015 · legal hold on/off; requires step-up (guarded at controller). */
  async setLegalHold(principal: Principal, id: string, on: boolean, reason: string): Promise<void> {
    if (!hasAnyRole(principal, 'COMPLIANCE', 'AUDIT_LEAD')) {
      throw new ForbiddenException('Legal hold hanya dapat ditetapkan oleh COMPLIANCE atau AUDIT_LEAD.')
    }
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Legal hold memerlukan alasan minimal 10 karakter.')
    }
    const engagement = await this.prisma.engagement.findUnique({
      where: { id },
      select: { id: true, legalHold: true },
    })
    if (!engagement) throw new NotFoundException('Penugasan tidak ditemukan.')
    if (engagement.legalHold === on) {
      throw new ConflictException(`Legal hold sudah ${on ? 'aktif' : 'nonaktif'}.`)
    }
    await this.uow.write(async (tx, audit) => {
      await tx.engagement.update({ where: { id }, data: { legalHold: on } })
      await audit.record({
        action: on ? 'BERLAKUKAN_LEGAL_HOLD' : 'CABUT_LEGAL_HOLD',
        objectType: 'ENGAGEMENT',
        objectId: id,
        before: { legal_hold: engagement.legalHold },
        after: { legal_hold: on, reason },
      })
    })
  }

  private visibilityWhere(principal: Principal): Prisma.EngagementWhereInput {
    if (hasAnyRole(principal, ...FIRM_WIDE_ROLES)) return {}
    return {
      OR: [
        { leadAuditorId: principal.userId },
        { members: { some: { userId: principal.userId } } },
      ],
    }
  }

  private async nextCode(type: EngagementType, year: number): Promise<string> {
    const prefix = ENGAGEMENT_CODE_PREFIX[type]
    const count = await this.prisma.engagement.count({
      where: { engagementType: type, periodFrom: {
        gte: new Date(`${year}-01-01`),
        lte: new Date(`${year}-12-31`),
      } },
    })
    return `${prefix}-${year}-${String(count + 1).padStart(3, '0')}`
  }

  private async requireActiveUser(userId: string, label: string): Promise<void> {
    const user = await this.prisma.appUser.findUnique({ where: { id: userId }, select: { isActive: true } })
    if (!user) throw new BadRequestException(`${label} tidak dikenal.`)
    if (!user.isActive) throw new BadRequestException(`${label} harus pengguna aktif.`)
  }

  private async requireControlsExist(controlIds: readonly string[]): Promise<void> {
    if (controlIds.length === 0) return
    const found = await this.prisma.control.count({ where: { id: { in: [...controlIds] } } })
    if (found !== new Set(controlIds).size) {
      throw new BadRequestException('Satu atau lebih kontrol dalam ruang lingkup tidak dikenal.')
    }
  }

  private presentSummary(e: {
    id: string
    code: string
    title: string
    engagementType: EngagementType
    periodFrom: Date
    periodTo: Date
    status: EngagementStatus
    legalHold: boolean
    leadAuditor: { id: string; externalId: string }
    _count: { members?: number; controls?: number; requestItems: number; findings: number }
  }) {
    return {
      id: e.id,
      code: e.code,
      title: e.title,
      engagement_type: e.engagementType,
      period_covered: {
        from: e.periodFrom.toISOString().slice(0, 10),
        to: e.periodTo.toISOString().slice(0, 10),
      },
      status: e.status,
      legal_hold: e.legalHold,
      lead_auditor: { id: e.leadAuditor.id, external_id: e.leadAuditor.externalId },
      control_count: e._count.controls ?? 0,
      request_item_count: e._count.requestItems,
      finding_count: e._count.findings,
    }
  }
}

const ENGAGEMENT_CODE_PREFIX: Record<EngagementType, string> = {
  AUDIT_INTERNAL: 'AI',
  AUDIT_EKSTERNAL: 'AE',
  PEMERIKSAAN_REGULATOR: 'PR',
  SELF_ASSESSMENT: 'SA',
  SERTIFIKASI: 'ST',
  AUDIT_INDUK: 'AD',
  TINJAUAN_MANAJEMEN: 'TM',
}
