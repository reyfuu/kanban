import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { FindingStatus, RiskLevel } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal } from '../shared/index.js'
import {
  evaluateSodRules,
  resolveGroupEntitlementIds,
  type EmployeeHolding,
  type SodRuleDef,
} from './access-detection.js'

export interface SodExceptionInput {
  readonly businessReason: string
  readonly compensatingControl: string
  readonly approvedBy: string
  readonly reviewDate: string
}

/**
 * FR-B-024 and FR-B-025 · SoD rules, violations, simulation and exceptions.
 *
 * Simulation (aturan 4) and detection share one evaluator — `evaluateSodRules`
 * from access-detection.ts — so the count a rule author sees before activating
 * is the count detection will raise. A simulation computed by different code
 * from detection is a promise the system does not keep: the author activates a
 * rule expecting six violations and gets nine.
 *
 * These reads are firm-wide by design. SoD is a cross-application, cross-unit
 * control (aturan 1); scoping violations to one division would hide exactly the
 * conflicts that span divisions, which are the ones that matter. The FRD gives
 * this authority to COMPLIANCE and SEC_OFFICER, gated at the controller.
 */
@Injectable()
export class SodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /** FR-B-024 · the rule library. */
  async listRules(_principal: Principal) {
    const rules = await this.prisma.sodRule.findMany({
      orderBy: [{ code: 'asc' }],
      include: { _count: { select: { violations: { where: { status: 'TERBUKA' } } } } },
    })
    return rules.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      risk_description: r.riskDescription,
      group_a: r.groupA,
      group_b: r.groupB,
      risk_level: r.riskLevel,
      compensating_control: r.compensatingControl,
      is_active: r.isActive,
      open_violation_count: r._count.violations,
    }))
  }

  /** FR-B-024 · current violations, newest first, with the pair named. */
  async listViolations(
    _principal: Principal,
    filter: { status?: FindingStatus; riskLevel?: RiskLevel; take: number },
  ) {
    const violations = await this.prisma.sodViolation.findMany({
      where: {
        AND: [
          filter.status ? { status: filter.status } : {},
          filter.riskLevel ? { rule: { riskLevel: filter.riskLevel } } : {},
        ],
      },
      include: {
        rule: { select: { code: true, name: true, riskLevel: true } },
        employee: {
          select: { id: true, fullName: true, jobTitle: true, employeeNumber: true },
        },
        entitlementA: {
          select: { displayName: true, application: { select: { code: true } } },
        },
        entitlementB: {
          select: { displayName: true, application: { select: { code: true } } },
        },
        exceptions: {
          where: { isActive: true },
          select: { id: true, reviewDate: true, businessReason: true },
        },
      },
      orderBy: [{ detectedAt: 'desc' }],
      take: filter.take,
    })

    return violations.map((v) => ({
      id: v.id,
      rule: { code: v.rule.code, name: v.rule.name, risk_level: v.rule.riskLevel },
      status: v.status,
      employee: {
        id: v.employee.id,
        full_name: v.employee.fullName,
        job_title: v.employee.jobTitle,
        employee_number: v.employee.employeeNumber,
      },
      entitlement_a: {
        display_name: v.entitlementA.displayName,
        application: v.entitlementA.application.code,
      },
      entitlement_b: {
        display_name: v.entitlementB.displayName,
        application: v.entitlementB.application.code,
      },
      detected_at: v.detectedAt.toISOString(),
      active_exception: v.exceptions[0]
        ? {
            id: v.exceptions[0].id,
            review_date: v.exceptions[0].reviewDate.toISOString().slice(0, 10),
          }
        : null,
    }))
  }

  /**
   * FR-B-024 aturan 4 · how many violations a rule would raise, computed
   * against current data before the rule is activated.
   *
   * Runs the exact evaluator detection uses, over every employee's holdings in
   * the latest completed snapshot per application. The rule need not exist yet:
   * groups are supplied inline, so an author can test a draft.
   */
  async simulate(
    _principal: Principal,
    input: { groupA: unknown; groupB: unknown },
  ): Promise<{
    would_violate_count: number
    affected_employees: unknown[]
    by_org_unit: { org_unit: string; count: number }[]
  }> {
    const entitlements = await this.prisma.entitlementCatalog.findMany({
      select: { id: true, technicalCode: true, displayName: true, application: { select: { code: true } } },
    })
    const codeToId = new Map<string, string>()
    const entMeta = new Map<string, { displayName: string; application: string }>()
    for (const e of entitlements) {
      codeToId.set(e.technicalCode.toUpperCase(), e.id)
      entMeta.set(e.id, { displayName: e.displayName, application: e.application.code })
    }

    const groupA = resolveGroupEntitlementIds(input.groupA, codeToId)
    const groupB = resolveGroupEntitlementIds(input.groupB, codeToId)
    if (groupA.size === 0 || groupB.size === 0) {
      throw new BadRequestException(
        'Kedua kelompok hak akses harus memuat sedikitnya satu hak akses yang dikenal.',
      )
    }

    const rule: SodRuleDef = {
      id: 'simulasi',
      code: 'SIMULASI',
      riskLevel: 'KRITIS',
      groupA,
      groupB,
    }

    const holdingsByEmployee = await this.holdingsByEmployee()
    const violations = evaluateSodRules(holdingsByEmployee, [rule])

    const employeeIds = [...new Set(violations.map((v) => v.employeeId))]
    const employees = await this.prisma.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        fullName: true,
        jobTitle: true,
        orgUnit: { select: { name: true } },
      },
    })
    const empById = new Map(employees.map((e) => [e.id, e]))

    const byOrgUnit = new Map<string, number>()
    const affected = violations.map((v) => {
      const emp = empById.get(v.employeeId)
      const orgUnit = emp?.orgUnit.name ?? 'Tanpa unit'
      byOrgUnit.set(orgUnit, (byOrgUnit.get(orgUnit) ?? 0) + 1)
      const a = entMeta.get(v.entitlementIdA)
      const b = entMeta.get(v.entitlementIdB)
      return {
        id: v.employeeId,
        full_name: emp?.fullName ?? '—',
        job_title: emp?.jobTitle ?? '—',
        group_a_entitlements: a ? [{ application: a.application, display_name: a.displayName }] : [],
        group_b_entitlements: b ? [{ application: b.application, display_name: b.displayName }] : [],
      }
    })

    return {
      would_violate_count: violations.length,
      affected_employees: affected,
      by_org_unit: [...byOrgUnit.entries()].map(([org_unit, count]) => ({ org_unit, count })),
    }
  }

  /**
   * FR-B-025 · record an exception against a violation.
   *
   * Requires a business reason, a compensating control, an approving officer and
   * a review date at most 12 months out (aturan 1). The violation is not deleted
   * — an active exception suppresses it from the "must act" view, and lapses on
   * its review date (aturan 3), at which point the conflict re-surfaces.
   */
  async grantException(
    _principal: Principal,
    violationId: string,
    input: SodExceptionInput,
  ): Promise<void> {
    const reviewDate = new Date(input.reviewDate)
    if (Number.isNaN(reviewDate.getTime())) {
      throw new BadRequestException('Tanggal peninjauan ulang tidak valid.')
    }
    const twelveMonths = new Date()
    twelveMonths.setMonth(twelveMonths.getMonth() + 12)
    if (reviewDate.getTime() <= Date.now() || reviewDate.getTime() > twelveMonths.getTime()) {
      throw new BadRequestException(
        'Tanggal peninjauan ulang harus di masa depan dan paling lama 12 bulan dari sekarang.',
      )
    }

    const violation = await this.prisma.sodViolation.findUnique({
      where: { id: violationId },
      select: { id: true, status: true },
    })
    if (!violation) throw new NotFoundException('Pelanggaran SoD tidak ditemukan.')
    if (violation.status !== 'TERBUKA') {
      throw new ConflictException(
        `Hanya pelanggaran berstatus TERBUKA yang dapat dikecualikan; pelanggaran ini ${violation.status}.`,
      )
    }

    const approver = await this.prisma.appUser.findUnique({
      where: { id: input.approvedBy },
      select: { id: true },
    })
    if (!approver) throw new BadRequestException('Pejabat penyetuju tidak dikenal.')

    await this.uow.write(async (tx, audit) => {
      await tx.sodException.create({
        data: {
          id: crypto.randomUUID(),
          violationId,
          businessReason: input.businessReason,
          compensatingControl: input.compensatingControl,
          approvedBy: input.approvedBy,
          reviewDate,
          isActive: true,
        },
      })
      await tx.sodViolation.update({
        where: { id: violationId },
        data: { status: 'DIKECUALIKAN', resolvedAt: new Date() },
      })
      await audit.record({
        action: 'KECUALIKAN_SOD',
        objectType: 'SOD_VIOLATION',
        objectId: violationId,
        before: { status: 'TERBUKA' },
        after: {
          status: 'DIKECUALIKAN',
          business_reason: input.businessReason,
          compensating_control: input.compensatingControl,
          approved_by: input.approvedBy,
          review_date: input.reviewDate,
        },
      })
    })
  }

  /** Holdings per employee from the latest completed snapshot of each application. */
  private async holdingsByEmployee(): Promise<Map<string, EmployeeHolding[]>> {
    const latest = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT ON (application_id) id
      FROM public.access_snapshot
      WHERE status = 'SELESAI'
      ORDER BY application_id, captured_at DESC
    `
    const snapshotIds = latest.map((r) => r.id)
    if (snapshotIds.length === 0) return new Map()

    const lines = await this.prisma.snapshotLine.findMany({
      where: { snapshotId: { in: snapshotIds }, employeeId: { not: null } },
      select: { snapshotId: true, entitlementId: true, employeeId: true },
    })

    const map = new Map<string, EmployeeHolding[]>()
    for (const line of lines) {
      const employeeId = line.employeeId!
      const list = map.get(employeeId) ?? []
      list.push({ employeeId, entitlementId: line.entitlementId, snapshotId: line.snapshotId })
      map.set(employeeId, list)
    }
    return map
  }
}
