import { randomUUID } from 'node:crypto'
import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { HostingType, ReviewFrequency, RiskLevel } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal } from '../shared/index.js'

export interface ApplicationInput {
  readonly code: string
  readonly name: string
  readonly ownerEmployeeId: string
  readonly techOwnerEmployeeId?: string | null
  readonly criticality: RiskLevel
  readonly hostingType: HostingType
  readonly reviewFrequency: ReviewFrequency
}

/**
 * FR-B-001 · the application registry write side.
 *
 * The registry is reference data an access review depends on: every review item
 * is an (identity, entitlement) pair on an application, so an application with
 * the wrong owner routes the wrong reviewer, and one that does not exist cannot
 * be reviewed at all. Registering and maintaining them is therefore a
 * SEC_OFFICER responsibility (`application:write`, checked at the controller).
 *
 * Owner and tech owner must be real employees: the owner receives revocation
 * tickets (FR-B-018), so a dangling owner id would mint tickets nobody holds.
 * Both foreign keys are validated here on the write path.
 *
 * Deactivation is a soft delete (isActive false), never a hard delete. An
 * application that has been reviewed is referenced by snapshots, campaigns and
 * tickets that must survive; removing the row would orphan an audit trail the
 * whole system exists to keep.
 */
@Injectable()
export class ApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  async create(principal: Principal, input: ApplicationInput): Promise<{ id: string }> {
    await this.assertEmployeesExist(input.ownerEmployeeId, input.techOwnerEmployeeId ?? null)

    const existing = await this.prisma.application.findUnique({
      where: { code: input.code },
      select: { id: true },
    })
    if (existing) throw new ConflictException(`Kode aplikasi "${input.code}" sudah dipakai.`)

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.application.create({
        data: {
          id,
          code: input.code,
          name: input.name,
          ownerEmployeeId: input.ownerEmployeeId,
          techOwnerEmployeeId: input.techOwnerEmployeeId ?? null,
          criticality: input.criticality,
          hostingType: input.hostingType,
          reviewFrequency: input.reviewFrequency,
        },
      })
      await audit.record({
        action: 'DAFTARKAN_APLIKASI',
        objectType: 'APPLICATION',
        objectId: id,
        after: { code: input.code, name: input.name, criticality: input.criticality },
      })
    })
    return { id }
  }

  async update(
    principal: Principal,
    id: string,
    input: Partial<Omit<ApplicationInput, 'code'>>,
  ): Promise<void> {
    const app = await this.prisma.application.findUnique({
      where: { id },
      select: { id: true, isActive: true, code: true, name: true, criticality: true },
    })
    if (!app) throw new NotFoundException('Aplikasi tidak ditemukan.')
    if (!app.isActive) throw new ConflictException('Aplikasi nonaktif tidak dapat disunting.')

    if (input.ownerEmployeeId !== undefined || input.techOwnerEmployeeId !== undefined) {
      await this.assertEmployeesExist(
        input.ownerEmployeeId ?? null,
        input.techOwnerEmployeeId ?? null,
      )
    }

    await this.uow.write(async (tx, audit) => {
      await tx.application.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.ownerEmployeeId !== undefined ? { ownerEmployeeId: input.ownerEmployeeId } : {}),
          ...(input.techOwnerEmployeeId !== undefined
            ? { techOwnerEmployeeId: input.techOwnerEmployeeId }
            : {}),
          ...(input.criticality !== undefined ? { criticality: input.criticality } : {}),
          ...(input.hostingType !== undefined ? { hostingType: input.hostingType } : {}),
          ...(input.reviewFrequency !== undefined ? { reviewFrequency: input.reviewFrequency } : {}),
        },
      })
      await audit.record({
        action: 'SUNTING_APLIKASI',
        objectType: 'APPLICATION',
        objectId: id,
        before: { name: app.name, criticality: app.criticality },
        after: { name: input.name ?? app.name, criticality: input.criticality ?? app.criticality },
      })
    })
  }

  /** FR-X-019 · deletion is a soft deactivation, not a hard delete. */
  async deactivate(principal: Principal, id: string): Promise<void> {
    const app = await this.prisma.application.findUnique({
      where: { id },
      select: { id: true, isActive: true, code: true },
    })
    if (!app) throw new NotFoundException('Aplikasi tidak ditemukan.')
    if (!app.isActive) throw new ConflictException('Aplikasi ini sudah nonaktif.')

    await this.uow.write(async (tx, audit) => {
      await tx.application.update({ where: { id }, data: { isActive: false } })
      await audit.record({
        action: 'NONAKTIFKAN_APLIKASI',
        objectType: 'APPLICATION',
        objectId: id,
        before: { is_active: true },
        after: { is_active: false, code: app.code },
      })
    })
  }

  /**
   * Employees for the owner/tech-owner pickers. Not the org directory (that is
   * FR-X-017 and larger) -- just enough to choose an owner when registering an
   * application, so the form is not asking for a raw UUID.
   */
  async listEmployeesForPicker(_principal: Principal) {
    const rows = await this.prisma.employee.findMany({
      where: { employmentStatus: 'AKTIF' },
      select: { id: true, fullName: true, jobTitle: true, employeeNumber: true },
      orderBy: { fullName: 'asc' },
      take: 500,
    })
    return rows.map((e) => ({
      id: e.id,
      full_name: e.fullName,
      job_title: e.jobTitle,
      employee_number: e.employeeNumber,
    }))
  }

  private async assertEmployeesExist(
    ownerId: string | null,
    techOwnerId: string | null,
  ): Promise<void> {
    const ids = [ownerId, techOwnerId].filter((v): v is string => v !== null)
    if (ids.length === 0) return
    const found = await this.prisma.employee.findMany({
      where: { id: { in: ids } },
      select: { id: true },
    })
    const foundIds = new Set(found.map((e) => e.id))
    for (const id of ids) {
      if (!foundIds.has(id)) {
        throw new BadRequestException(`Karyawan dengan id ${id} tidak ditemukan.`)
      }
    }
  }
}
