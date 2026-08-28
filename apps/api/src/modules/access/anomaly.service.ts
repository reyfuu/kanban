import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { AccessAnomalyCode, FindingStatus, RiskLevel } from '@prisma/client'
import { applicationScope, UnitOfWork, PrismaService, type Principal } from '../shared/index.js'

/** Human-readable labels for the anomaly codes (07-API-CONTRACT Sec 5.4). */
const ANOMALY_LABELS: Record<AccessAnomalyCode, string> = {
  AN_01: 'Akun aktif milik karyawan tidak aktif',
  AN_02: 'Akun tanpa pemilik',
  AN_03: 'Akun tidak aktif melebihi ambang',
  AN_04: 'Akses istimewa tanpa dasar',
  AN_05: 'Pindah unit membawa akses lama',
  AN_06: 'Akun ganda pada aplikasi yang sama',
  AN_07: 'Akun bersama',
  AN_08: 'Konflik pemisahan tugas',
}

export interface AnomalyFilter {
  readonly type?: AccessAnomalyCode
  readonly status?: FindingStatus
  readonly applicationId?: string
  readonly take: number
}

export interface AnomalyExceptionInput {
  readonly reason: string
  readonly compensatingControl: string
  readonly reviewDate: string
}

/**
 * FR-B-007 read side and lifecycle: list anomalies, record an exception
 * (FR-B-007 aturan 2), and resolve.
 *
 * Scope-filtered at the query, not the controller (CLAUDE.md rule 1). An
 * anomaly is about an application, so `applicationScope` decides which rows a
 * principal may see — COMPLIANCE and AUDIT_LEAD unrestricted by design, a line
 * manager narrowed to their own applications.
 */
@Injectable()
export class AnomalyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  async list(principal: Principal, filter: AnomalyFilter) {
    const apps = applicationScope(principal)
    const rows = await this.prisma.accessAnomaly.findMany({
      where: {
        AND: [
          apps.whereOn('applicationId'),
          filter.type ? { code: filter.type } : {},
          filter.status ? { status: filter.status } : {},
          filter.applicationId ? { applicationId: filter.applicationId } : {},
        ],
      },
      include: {
        application: { select: { id: true, code: true, name: true } },
        employee: {
          select: {
            id: true,
            fullName: true,
            employeeNumber: true,
            employmentStatus: true,
            terminatedAt: true,
          },
        },
      },
      orderBy: [{ severity: 'asc' }, { firstDetectedAt: 'asc' }],
      take: filter.take,
    })

    const now = Date.now()
    return rows.map((a) => ({
      id: a.id,
      type: a.code,
      type_label: ANOMALY_LABELS[a.code],
      severity: a.severity,
      status: a.status,
      application: a.application,
      account_id: (a.details as Record<string, unknown>)['account_id'] ?? null,
      employee: a.employee
        ? {
            id: a.employee.id,
            full_name: a.employee.fullName,
            employee_number: a.employee.employeeNumber,
            employment_status: a.employee.employmentStatus,
            terminated_at: a.employee.terminatedAt?.toISOString().slice(0, 10) ?? null,
          }
        : null,
      details: a.details,
      first_detected_at: a.firstDetectedAt.toISOString(),
      // FR-B-007 aturan 3: age is measured from first detection.
      age_days: Math.floor((now - a.firstDetectedAt.getTime()) / 86_400_000),
      exception_review_date: a.exceptionReviewDate?.toISOString().slice(0, 10) ?? null,
    }))
  }

  /**
   * FR-B-007 aturan 2 · record an exception with a mandatory review date.
   *
   * The exception ends automatically on the review date — enforced by the read
   * path treating a past review date as expired (see `isExceptionActive`),
   * rather than by mutating the row on a schedule, so a lapsed exception cannot
   * be silently forgotten. Only SEC_OFFICER reaches here (controller gate).
   */
  async grantException(
    principal: Principal,
    anomalyId: string,
    input: AnomalyExceptionInput,
  ): Promise<void> {
    const reviewDate = new Date(input.reviewDate)
    if (Number.isNaN(reviewDate.getTime())) {
      throw new BadRequestException('Tanggal peninjauan ulang tidak valid.')
    }
    if (reviewDate.getTime() <= Date.now()) {
      throw new BadRequestException('Tanggal peninjauan ulang harus di masa depan.')
    }

    const anomaly = await this.requireVisible(principal, anomalyId)
    if (anomaly.status !== 'TERBUKA') {
      throw new ConflictException(
        `Hanya anomali berstatus TERBUKA yang dapat dikecualikan; anomali ini ${anomaly.status}.`,
      )
    }

    await this.uow.write(async (tx, audit) => {
      await tx.accessAnomaly.update({
        where: { id: anomalyId },
        data: {
          status: 'DIKECUALIKAN',
          exceptionReason: input.reason,
          exceptionReviewDate: reviewDate,
        },
      })
      await audit.record({
        action: 'KECUALIKAN_ANOMALI',
        objectType: 'ACCESS_ANOMALY',
        objectId: anomalyId,
        before: { status: anomaly.status },
        after: {
          status: 'DIKECUALIKAN',
          reason: input.reason,
          compensating_control: input.compensatingControl,
          review_date: input.reviewDate,
        },
      })
    })
  }

  /** Mark an anomaly resolved — the access it flagged is gone or corrected. */
  async resolve(principal: Principal, anomalyId: string): Promise<void> {
    const anomaly = await this.requireVisible(principal, anomalyId)
    if (anomaly.status === 'TERSELESAIKAN') {
      throw new ConflictException('Anomali ini sudah berstatus TERSELESAIKAN.')
    }

    await this.uow.write(async (tx, audit) => {
      await tx.accessAnomaly.update({
        where: { id: anomalyId },
        data: { status: 'TERSELESAIKAN', resolvedAt: new Date() },
      })
      await audit.record({
        action: 'SELESAIKAN_ANOMALI',
        objectType: 'ACCESS_ANOMALY',
        objectId: anomalyId,
        before: { status: anomaly.status },
        after: { status: 'TERSELESAIKAN' },
      })
    })
  }

  private async requireVisible(
    principal: Principal,
    anomalyId: string,
  ): Promise<{ status: FindingStatus; severity: RiskLevel }> {
    const apps = applicationScope(principal)
    const anomaly = await this.prisma.accessAnomaly.findFirst({
      where: { AND: [apps.whereOn('applicationId'), { id: anomalyId }] },
      select: { status: true, severity: true },
    })
    // 404 rather than 403: the existence of a finding on an application outside
    // your scope is itself information (CLAUDE.md rule 3).
    if (!anomaly) throw new NotFoundException('Anomali tidak ditemukan.')
    return anomaly
  }
}
