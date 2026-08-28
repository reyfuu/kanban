import { randomUUID } from 'node:crypto'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { ControlFrequency, ControlNature, ControlType, RiskLevel } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal, type TransactionClient } from '../shared/index.js'

export interface ControlInput {
  readonly code: string
  readonly title: string
  readonly objective: string
  readonly ownerEmployeeId: string
  readonly executingOrgUnitId?: string
  readonly frequency: ControlFrequency
  readonly controlType: ControlType
  readonly nature: ControlNature
  readonly riskLevel: RiskLevel
  readonly testProcedure?: string
  readonly expectedEvidenceTypes: readonly string[]
}

export type ControlPatch = Partial<Omit<ControlInput, 'code'>>

export interface ControlListFilter {
  readonly q?: string
  readonly riskLevel?: RiskLevel
  readonly isActive?: boolean
  readonly take: number
}

/**
 * FR-A-001 · the enterprise control library.
 *
 * Three rules shape every write here:
 *
 * - The code is immutable once the control has been used on an engagement
 *   (rule 1). Engagements are a later slice, so "used" cannot yet be observed;
 *   the code is nonetheless never accepted on update, so the invariant holds
 *   from day one rather than being retrofitted once engagements exist.
 * - An edit produces a new version (rule 2): every create writes version 1, and
 *   every mutating edit bumps current_version and snapshots the prior state, so
 *   a completed engagement can always reproduce the control text in force at the
 *   time. The snapshot is written in the same audited transaction as the edit.
 * - A control is retired, never deleted (rule 3): deactivate flips is_active.
 */
@Injectable()
export class ControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /** FR-A-001 · `GET /controls`, filtered by free text, risk and active flag. */
  async list(_principal: Principal, filter: ControlListFilter) {
    const controls = await this.prisma.control.findMany({
      where: {
        AND: [
          filter.riskLevel ? { riskLevel: filter.riskLevel } : {},
          filter.isActive !== undefined ? { isActive: filter.isActive } : {},
          filter.q
            ? {
                OR: [
                  { code: { contains: filter.q, mode: 'insensitive' } },
                  { title: { contains: filter.q, mode: 'insensitive' } },
                  { objective: { contains: filter.q, mode: 'insensitive' } },
                ],
              }
            : {},
        ],
      },
      include: {
        ownerEmployee: { select: { id: true, fullName: true } },
        executingOrgUnit: { select: { id: true, code: true, name: true } },
        _count: { select: { mappings: true } },
      },
      orderBy: [{ code: 'asc' }],
      take: filter.take,
    })
    return controls.map((c) => this.present(c))
  }

  async findOne(_principal: Principal, id: string) {
    const control = await this.prisma.control.findUnique({
      where: { id },
      include: {
        ownerEmployee: { select: { id: true, fullName: true } },
        executingOrgUnit: { select: { id: true, code: true, name: true } },
        _count: { select: { mappings: true } },
      },
    })
    if (!control) throw new NotFoundException('Kontrol tidak ditemukan.')
    return this.present(control)
  }

  async listVersions(_principal: Principal, id: string) {
    await this.requireControl(id)
    const versions = await this.prisma.controlVersion.findMany({
      where: { controlId: id },
      include: { changedByUser: { select: { id: true, externalId: true } } },
      orderBy: [{ versionNo: 'desc' }],
    })
    return versions.map((v) => ({
      version_no: v.versionNo,
      title: v.title,
      objective: v.objective,
      frequency: v.frequency,
      control_type: v.controlType,
      nature: v.nature,
      risk_level: v.riskLevel,
      test_procedure: v.testProcedure,
      changed_by: v.changedByUser.externalId,
      changed_at: v.changedAt.toISOString(),
    }))
  }

  /** FR-A-001 · create a control and its version 1 in one audited transaction. */
  async create(principal: Principal, input: ControlInput): Promise<{ id: string }> {
    const existing = await this.prisma.control.findUnique({ where: { code: input.code }, select: { id: true } })
    if (existing) throw new ConflictException(`Kode kontrol ${input.code} sudah dipakai.`)

    await this.requireOwner(input.ownerEmployeeId)

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.control.create({
        data: {
          id,
          code: input.code,
          title: input.title,
          objective: input.objective,
          ownerEmployeeId: input.ownerEmployeeId,
          executingOrgUnitId: input.executingOrgUnitId ?? null,
          frequency: input.frequency,
          controlType: input.controlType,
          nature: input.nature,
          riskLevel: input.riskLevel,
          testProcedure: input.testProcedure ?? null,
          expectedEvidenceTypes: [...input.expectedEvidenceTypes],
          currentVersion: 1,
          isActive: true,
        },
      })
      await this.writeVersion(tx, id, 1, input, principal.userId)
      await audit.record({
        action: 'BUAT_KONTROL',
        objectType: 'CONTROL',
        objectId: id,
        after: { code: input.code, title: input.title, version_no: 1 },
      })
    })
    return { id }
  }

  /**
   * FR-A-001 aturan 2 · edit a control, producing a new version.
   *
   * The code is deliberately not in ControlPatch, so this cannot rename a
   * control. Every edit snapshots the resulting state as the next version and
   * bumps current_version, all in one audited transaction.
   */
  async update(principal: Principal, id: string, patch: ControlPatch): Promise<void> {
    const control = await this.requireControl(id)
    if (!control.isActive) {
      throw new ConflictException('Kontrol yang sudah dinonaktifkan tidak dapat disunting.')
    }
    if (patch.ownerEmployeeId) await this.requireOwner(patch.ownerEmployeeId)

    const nextVersion = control.currentVersion + 1
    const merged: ControlInput = {
      code: control.code,
      title: patch.title ?? control.title,
      objective: patch.objective ?? control.objective,
      ownerEmployeeId: patch.ownerEmployeeId ?? control.ownerEmployeeId,
      ...(patch.executingOrgUnitId !== undefined
        ? { executingOrgUnitId: patch.executingOrgUnitId }
        : control.executingOrgUnitId
          ? { executingOrgUnitId: control.executingOrgUnitId }
          : {}),
      frequency: patch.frequency ?? control.frequency,
      controlType: patch.controlType ?? control.controlType,
      nature: patch.nature ?? control.nature,
      riskLevel: patch.riskLevel ?? control.riskLevel,
      ...(patch.testProcedure !== undefined
        ? { testProcedure: patch.testProcedure }
        : control.testProcedure
          ? { testProcedure: control.testProcedure }
          : {}),
      expectedEvidenceTypes: patch.expectedEvidenceTypes ?? control.expectedEvidenceTypes,
    }

    await this.uow.write(async (tx, audit) => {
      await tx.control.update({
        where: { id },
        data: {
          title: merged.title,
          objective: merged.objective,
          ownerEmployeeId: merged.ownerEmployeeId,
          executingOrgUnitId: merged.executingOrgUnitId ?? null,
          frequency: merged.frequency,
          controlType: merged.controlType,
          nature: merged.nature,
          riskLevel: merged.riskLevel,
          testProcedure: merged.testProcedure ?? null,
          expectedEvidenceTypes: [...merged.expectedEvidenceTypes],
          currentVersion: nextVersion,
        },
      })
      await this.writeVersion(tx, id, nextVersion, merged, principal.userId)
      await audit.record({
        action: 'UBAH_KONTROL',
        objectType: 'CONTROL',
        objectId: id,
        before: { version_no: control.currentVersion },
        after: { version_no: nextVersion },
      })
    })
  }

  /** FR-A-001 aturan 3 · retire (deactivate); never delete. */
  async setActive(_principal: Principal, id: string, isActive: boolean): Promise<void> {
    const control = await this.requireControl(id)
    if (control.isActive === isActive) {
      throw new ConflictException(
        `Kontrol sudah ${isActive ? 'aktif' : 'nonaktif'}.`,
      )
    }
    await this.uow.write(async (tx, audit) => {
      await tx.control.update({ where: { id }, data: { isActive } })
      await audit.record({
        action: isActive ? 'AKTIFKAN_KONTROL' : 'NONAKTIFKAN_KONTROL',
        objectType: 'CONTROL',
        objectId: id,
        before: { is_active: control.isActive },
        after: { is_active: isActive },
      })
    })
  }

  private async writeVersion(
    tx: TransactionClient,
    controlId: string,
    versionNo: number,
    input: ControlInput,
    changedBy: string,
  ): Promise<void> {
    await tx.controlVersion.create({
      data: {
        id: randomUUID(),
        controlId,
        versionNo,
        title: input.title,
        objective: input.objective,
        frequency: input.frequency,
        controlType: input.controlType,
        nature: input.nature,
        riskLevel: input.riskLevel,
        testProcedure: input.testProcedure ?? null,
        snapshot: {
          code: input.code,
          owner_employee_id: input.ownerEmployeeId,
          executing_org_unit_id: input.executingOrgUnitId ?? null,
          expected_evidence_types: [...input.expectedEvidenceTypes],
        },
        changedBy,
      },
    })
  }

  private async requireControl(id: string) {
    const control = await this.prisma.control.findUnique({ where: { id } })
    if (!control) throw new NotFoundException('Kontrol tidak ditemukan.')
    return control
  }

  private async requireOwner(employeeId: string): Promise<void> {
    const owner = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { employmentStatus: true },
    })
    if (!owner) throw new BadRequestException('Pemilik kontrol tidak dikenal.')
    if (owner.employmentStatus !== 'AKTIF') {
      throw new BadRequestException('Pemilik kontrol harus karyawan aktif.')
    }
  }

  private present(c: {
    id: string
    code: string
    title: string
    objective: string
    frequency: ControlFrequency
    controlType: ControlType
    nature: ControlNature
    riskLevel: RiskLevel
    testProcedure: string | null
    expectedEvidenceTypes: string[]
    currentVersion: number
    isActive: boolean
    ownerEmployee: { id: string; fullName: string }
    executingOrgUnit: { id: string; code: string; name: string } | null
    _count: { mappings: number }
  }) {
    return {
      id: c.id,
      code: c.code,
      title: c.title,
      objective: c.objective,
      owner: { id: c.ownerEmployee.id, full_name: c.ownerEmployee.fullName },
      executing_org_unit: c.executingOrgUnit
        ? { id: c.executingOrgUnit.id, code: c.executingOrgUnit.code, name: c.executingOrgUnit.name }
        : null,
      frequency: c.frequency,
      control_type: c.controlType,
      nature: c.nature,
      risk_level: c.riskLevel,
      test_procedure: c.testProcedure,
      expected_evidence_types: c.expectedEvidenceTypes,
      current_version: c.currentVersion,
      is_active: c.isActive,
      mapping_count: c._count.mappings,
    }
  }
}
