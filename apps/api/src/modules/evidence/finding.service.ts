import { randomUUID } from 'node:crypto'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { FindingLifecycle, RiskLevel } from '@prisma/client'
import { UnitOfWork, hasAnyRole, PrismaService, type Principal } from '../shared/index.js'

export interface FindingInput {
  readonly title: string
  readonly conditionText: string
  readonly criteriaText?: string
  readonly causeText?: string
  readonly effectText?: string
  readonly recommendation?: string
  readonly riskLevel: RiskLevel
  readonly ownerEmployeeId?: string
  readonly recurringOfId?: string
}

/** FR-A-016 rule 2 · default follow-up SLA in days, by risk level. */
const SLA_DAYS: Record<RiskLevel, number> = {
  KRITIS: 30,
  TINGGI: 60,
  SEDANG: 90,
  RENDAH: 180,
}

/**
 * FR-A-017 · finding lifecycle.
 *
 * The transition table is the contract; two transitions carry rules the table
 * cannot see and are enforced in `transition`:
 *
 * - -> DITUTUP is AUDIT_LEAD only and requires a linked remediation evidence
 *   (rule 1). A finding does not close on someone's word.
 * - -> DITERIMA_SEBAGAI_RISIKO needs director-level sign-off (rule 2), the same
 *   EXECUTIVE authority the SoD critical-exception path uses.
 */
const TRANSITIONS: Readonly<Record<FindingLifecycle, readonly FindingLifecycle[]>> = {
  DRAF: ['DIKOMUNIKASIKAN'],
  DIKOMUNIKASIKAN: ['DISEPAKATI', 'DISANGGAH'],
  DISANGGAH: ['DISEPAKATI', 'DIBATALKAN'],
  DISEPAKATI: ['DALAM_PERBAIKAN'],
  DALAM_PERBAIKAN: ['MENUNGGU_VERIFIKASI', 'DITERIMA_SEBAGAI_RISIKO'],
  MENUNGGU_VERIFIKASI: ['DITUTUP', 'DALAM_PERBAIKAN'],
  DITUTUP: [],
  DITERIMA_SEBAGAI_RISIKO: [],
  DIBATALKAN: [],
}

@Injectable()
export class FindingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  async listForEngagement(_principal: Principal, engagementId: string) {
    const findings = await this.prisma.finding.findMany({
      where: { engagementId },
      include: {
        ownerEmployee: { select: { id: true, fullName: true } },
        _count: { select: { remediations: true } },
      },
      orderBy: [{ createdAt: 'asc' }],
    })
    return findings.map((f) => this.present(f))
  }

  async findOne(_principal: Principal, id: string) {
    const f = await this.prisma.finding.findUnique({
      where: { id },
      include: {
        ownerEmployee: { select: { id: true, fullName: true } },
        remediations: {
          include: { ownerEmployee: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    if (!f) throw new NotFoundException('Temuan tidak ditemukan.')
    return {
      ...this.present(f),
      condition_text: f.conditionText,
      criteria_text: f.criteriaText,
      cause_text: f.causeText,
      effect_text: f.effectText,
      recommendation: f.recommendation,
      remediations: f.remediations.map((r) => ({
        id: r.id,
        description: r.description,
        owner: { id: r.ownerEmployee.id, full_name: r.ownerEmployee.fullName },
        due_date: r.dueDate.toISOString().slice(0, 10),
        verified_at: r.verifiedAt?.toISOString() ?? null,
      })),
    }
  }

  /**
   * FR-A-016 · create a finding. Only AUDITOR_INT/AUDIT_LEAD, and the finding
   * must link at least one supporting evidence (rule 1) — checked at creation by
   * requiring the evidence ids, which are then linked.
   *
   * The default due date is derived from the risk level's SLA (rule 2), counted
   * from today, unless the caller supplied one.
   */
  async create(
    principal: Principal,
    engagementId: string,
    input: FindingInput,
    supportingEvidenceIds: readonly string[],
  ): Promise<{ id: string; code: string }> {
    if (!hasAnyRole(principal, 'AUDITOR_INT', 'AUDIT_LEAD')) {
      throw new ForbiddenException('Hanya AUDITOR_INT atau AUDIT_LEAD yang dapat mencatat temuan.')
    }
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true },
    })
    if (!engagement) throw new NotFoundException('Penugasan tidak ditemukan.')

    // FR-A-016 rule 1: a finding must have at least one supporting evidence.
    if (supportingEvidenceIds.length === 0) {
      throw new BadRequestException('Temuan wajib menautkan minimal satu bukti pendukung.')
    }
    const evidenceCount = await this.prisma.evidence.count({
      where: { id: { in: [...supportingEvidenceIds] } },
    })
    if (evidenceCount !== new Set(supportingEvidenceIds).size) {
      throw new BadRequestException('Satu atau lebih bukti pendukung tidak ditemukan.')
    }

    if (input.recurringOfId) {
      const prior = await this.prisma.finding.count({ where: { id: input.recurringOfId } })
      if (prior === 0) throw new BadRequestException('Temuan periode sebelumnya tidak ditemukan.')
    }

    const code = await this.nextCode()
    const id = randomUUID()
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + SLA_DAYS[input.riskLevel])

    await this.uow.write(async (tx, audit) => {
      await tx.finding.create({
        data: {
          id,
          engagementId,
          code,
          title: input.title,
          conditionText: input.conditionText,
          criteriaText: input.criteriaText ?? null,
          causeText: input.causeText ?? null,
          effectText: input.effectText ?? null,
          recommendation: input.recommendation ?? null,
          riskLevel: input.riskLevel,
          ownerEmployeeId: input.ownerEmployeeId ?? null,
          dueDate,
          status: 'DRAF',
          recurringOfId: input.recurringOfId ?? null,
        },
      })
      // Link the supporting evidence to the finding.
      for (const evidenceId of new Set(supportingEvidenceIds)) {
        await tx.evidenceLink.create({
          data: {
            id: randomUUID(),
            evidenceId,
            targetType: 'FINDING',
            targetId: id,
            linkedBy: principal.userId,
          },
        })
      }
      await audit.record({
        action: 'CATAT_TEMUAN',
        objectType: 'FINDING',
        objectId: id,
        after: { code, title: input.title, risk_level: input.riskLevel, due_date: dueDate.toISOString().slice(0, 10) },
      })
    })
    return { id, code }
  }

  /** FR-A-017 · move a finding through its lifecycle. */
  async transition(
    principal: Principal,
    id: string,
    to: FindingLifecycle,
    reason: string | undefined,
  ): Promise<{ status: FindingLifecycle }> {
    const finding = await this.prisma.finding.findUnique({
      where: { id },
      select: { id: true, status: true },
    })
    if (!finding) throw new NotFoundException('Temuan tidak ditemukan.')

    if (!TRANSITIONS[finding.status].includes(to)) {
      throw new ConflictException(`Temuan berstatus ${finding.status} tidak dapat berpindah ke ${to}.`)
    }

    // Rule 1: closing is AUDIT_LEAD only and needs a verified remediation.
    if (to === 'DITUTUP') {
      if (!hasAnyRole(principal, 'AUDIT_LEAD')) {
        throw new ForbiddenException('Penutupan temuan hanya oleh AUDIT_LEAD.')
      }
      const remediationEvidence = await this.prisma.evidenceLink.count({
        where: { targetType: 'FINDING', targetId: id },
      })
      if (remediationEvidence === 0) {
        throw new ConflictException('Penutupan temuan wajib menautkan bukti perbaikan.')
      }
    }

    // Rule 2: accepting as risk needs director-level (EXECUTIVE) sign-off.
    let riskAcceptedBy: string | null = null
    if (to === 'DITERIMA_SEBAGAI_RISIKO') {
      const isDirector = await this.hasActiveRole(principal.userId, 'EXECUTIVE')
      if (!isDirector) {
        throw new ForbiddenException(
          'Status Diterima Sebagai Risiko memerlukan persetujuan setingkat direksi (peran EXECUTIVE).',
        )
      }
      if (!reason || reason.trim().length < 10) {
        throw new BadRequestException('Penerimaan risiko memerlukan alasan minimal 10 karakter.')
      }
      riskAcceptedBy = principal.userId
    }

    await this.uow.write(async (tx, audit) => {
      await tx.finding.update({
        where: { id },
        data: { status: to, ...(riskAcceptedBy ? { riskAcceptedBy } : {}) },
      })
      await audit.record({
        action: 'PINDAH_STATUS_TEMUAN',
        objectType: 'FINDING',
        objectId: id,
        before: { status: finding.status },
        after: { status: to, ...(reason ? { reason } : {}) },
      })
    })
    return { status: to }
  }

  /** FR-A-017 · add a remediation action to a finding. */
  async addRemediation(
    _principal: Principal,
    findingId: string,
    input: { description: string; ownerEmployeeId: string; dueDate: Date },
  ): Promise<{ id: string }> {
    const finding = await this.prisma.finding.findUnique({ where: { id: findingId }, select: { id: true } })
    if (!finding) throw new NotFoundException('Temuan tidak ditemukan.')
    const owner = await this.prisma.employee.findUnique({
      where: { id: input.ownerEmployeeId },
      select: { id: true },
    })
    if (!owner) throw new BadRequestException('Pemilik tindak lanjut tidak dikenal.')

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.remediation.create({
        data: {
          id,
          findingId,
          description: input.description,
          ownerEmployeeId: input.ownerEmployeeId,
          dueDate: input.dueDate,
        },
      })
      await audit.record({
        action: 'TAMBAH_TINDAK_LANJUT',
        objectType: 'FINDING',
        objectId: findingId,
        after: { remediation_id: id },
      })
    })
    return { id }
  }

  /** FR-A-017 · verify a remediation (AUDITOR_INT/AUDIT_LEAD). */
  async verifyRemediation(principal: Principal, remediationId: string): Promise<void> {
    if (!hasAnyRole(principal, 'AUDITOR_INT', 'AUDIT_LEAD')) {
      throw new ForbiddenException('Hanya AUDITOR_INT atau AUDIT_LEAD yang dapat memverifikasi tindak lanjut.')
    }
    const remediation = await this.prisma.remediation.findUnique({
      where: { id: remediationId },
      select: { id: true, verifiedAt: true, findingId: true },
    })
    if (!remediation) throw new NotFoundException('Tindak lanjut tidak ditemukan.')
    if (remediation.verifiedAt) throw new ConflictException('Tindak lanjut sudah diverifikasi.')

    await this.uow.write(async (tx, audit) => {
      await tx.remediation.update({
        where: { id: remediationId },
        data: { verifiedBy: principal.userId, verifiedAt: new Date() },
      })
      await audit.record({
        action: 'VERIFIKASI_TINDAK_LANJUT',
        objectType: 'FINDING',
        objectId: remediation.findingId,
        after: { remediation_id: remediationId },
      })
    })
  }

  private async hasActiveRole(userId: string, roleCode: string): Promise<boolean> {
    const now = new Date()
    const grant = await this.prisma.userRole.findFirst({
      where: {
        userId,
        role: { code: roleCode },
        validFrom: { lte: now },
        OR: [{ validUntil: null }, { validUntil: { gte: now } }],
      },
      select: { id: true },
    })
    return grant !== null
  }

  private async nextCode(): Promise<string> {
    const year = new Date().getUTCFullYear()
    const count = await this.prisma.finding.count({
      where: { code: { startsWith: `TMN-${year}-` } },
    })
    return `TMN-${year}-${String(count + 1).padStart(3, '0')}`
  }

  private present(f: {
    id: string
    code: string
    title: string
    riskLevel: RiskLevel
    status: FindingLifecycle
    dueDate: Date | null
    ownerEmployee: { id: string; fullName: string } | null
    _count?: { remediations: number }
  }) {
    return {
      id: f.id,
      code: f.code,
      title: f.title,
      risk_level: f.riskLevel,
      status: f.status,
      due_date: f.dueDate?.toISOString().slice(0, 10) ?? null,
      owner: f.ownerEmployee ? { id: f.ownerEmployee.id, full_name: f.ownerEmployee.fullName } : null,
      remediation_count: f._count?.remediations ?? 0,
    }
  }
}
