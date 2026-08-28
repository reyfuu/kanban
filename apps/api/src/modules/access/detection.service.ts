import { Injectable, Logger } from '@nestjs/common'
import { PrismaService, UnitOfWork, type TransactionClient } from '../shared/index.js'
import {
  detectPerSnapshotAnomalies,
  evaluateSodRules,
  resolveGroupEntitlementIds,
  type DetectedAnomaly,
  type DetectedSodViolation,
  type DetectionLine,
  type EmployeeHolding,
  type SodRuleDef,
} from './access-detection.js'

export interface DetectionOutcome {
  readonly snapshotId: string
  readonly anomaliesOpened: number
  readonly anomaliesCarriedForward: number
  readonly sodViolationsOpened: number
}

/**
 * FR-B-007 and FR-B-024 · runs detection when a new snapshot lands.
 *
 * Called after a snapshot commits, from the same authenticated request that
 * created it, so the audit context carries a real actor. It is deliberately
 * outside the snapshot's own transaction, for the same reason revocation
 * verification is (see SnapshotController): the snapshot is a fact, and a
 * detection failure must not roll back a capture that was stored correctly.
 *
 * Anomaly persistence honours FR-B-007 aturan 3 — an unresolved finding that
 * reappears in a later snapshot is carried forward (its lastDetectedAt moves,
 * its firstDetectedAt does not), so its age is measured from when it was first
 * seen, not from the most recent capture. A finding that no longer reproduces
 * is left as it was; nothing here silently closes findings.
 */
@Injectable()
export class DetectionService {
  private readonly logger = new Logger(DetectionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * Detect for the application a snapshot belongs to.
   *
   * Per-snapshot anomalies (AN-01, AN-02) are read from this snapshot's lines.
   * SoD (AN-08 / FR-B-024) is cross-application by rule, so it is evaluated
   * against every application's latest completed snapshot, not just this one —
   * a new capture in Trading can complete a toxic pair whose other half sits in
   * Back Office.
   */
  async runForSnapshot(snapshotId: string): Promise<DetectionOutcome> {
    const snapshot = await this.prisma.accessSnapshot.findUnique({
      where: { id: snapshotId },
      select: { id: true, applicationId: true, status: true },
    })
    if (!snapshot || snapshot.status !== 'SELESAI') {
      // Same stance as verification: an incomplete snapshot is missing rows for
      // reasons unrelated to risk, and detecting against it would raise and
      // clear findings on import artefacts.
      return { snapshotId, anomaliesOpened: 0, anomaliesCarriedForward: 0, sodViolationsOpened: 0 }
    }

    const lines = await this.loadDetectionLines(snapshotId)
    const anomalies = detectPerSnapshotAnomalies(lines)

    const sodViolations = await this.evaluateSod()

    return this.persist(snapshot.id, snapshot.applicationId, anomalies, sodViolations)
  }

  private async loadDetectionLines(snapshotId: string): Promise<DetectionLine[]> {
    const rows = await this.prisma.snapshotLine.findMany({
      where: { snapshotId },
      select: {
        id: true,
        accountId: true,
        accountStatus: true,
        entitlementId: true,
        entitlement: { select: { technicalCode: true, isPrivileged: true } },
        employeeId: true,
        employee: { select: { employmentStatus: true } },
      },
    })

    return rows.map((r) => ({
      snapshotLineId: r.id,
      accountId: r.accountId,
      entitlementId: r.entitlementId,
      entitlementCode: r.entitlement.technicalCode,
      isPrivileged: r.entitlement.isPrivileged,
      employeeId: r.employeeId,
      employmentStatus: r.employee?.employmentStatus ?? null,
      accountStatus: r.accountStatus,
    }))
  }

  /**
   * FR-B-024 · evaluate active SoD rules against every employee's current
   * holdings, drawn from the latest completed snapshot of each application.
   */
  private async evaluateSod(): Promise<DetectedSodViolation[]> {
    const rawRules = await this.prisma.sodRule.findMany({
      where: { isActive: true },
      select: { id: true, code: true, riskLevel: true, groupA: true, groupB: true },
    })
    if (rawRules.length === 0) return []

    const codeToId = new Map<string, string>()
    const entitlements = await this.prisma.entitlementCatalog.findMany({
      select: { id: true, technicalCode: true },
    })
    for (const e of entitlements) codeToId.set(e.technicalCode.toUpperCase(), e.id)

    const rules: SodRuleDef[] = rawRules.map((r) => ({
      id: r.id,
      code: r.code,
      riskLevel: r.riskLevel,
      groupA: resolveGroupEntitlementIds(r.groupA, codeToId),
      groupB: resolveGroupEntitlementIds(r.groupB, codeToId),
    }))

    // The latest completed snapshot per application, then all their lines with a
    // resolved employee. A holding without an employee cannot participate in a
    // per-person SoD conflict, so ownerless lines are excluded here.
    const latest = await this.latestSnapshotIdsPerApplication()
    if (latest.length === 0) return []

    const holdingLines = await this.prisma.snapshotLine.findMany({
      where: { snapshotId: { in: latest }, employeeId: { not: null } },
      select: { snapshotId: true, entitlementId: true, employeeId: true },
    })

    const holdingsByEmployee = new Map<string, EmployeeHolding[]>()
    for (const line of holdingLines) {
      const employeeId = line.employeeId!
      const list = holdingsByEmployee.get(employeeId) ?? []
      list.push({ employeeId, entitlementId: line.entitlementId, snapshotId: line.snapshotId })
      holdingsByEmployee.set(employeeId, list)
    }

    return evaluateSodRules(holdingsByEmployee, rules)
  }

  private async latestSnapshotIdsPerApplication(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT ON (application_id) id
      FROM public.access_snapshot
      WHERE status = 'SELESAI'
      ORDER BY application_id, captured_at DESC
    `
    return rows.map((r) => r.id)
  }

  /**
   * Persist findings in one audited transaction.
   *
   * Idempotency and carry-forward are the same query: for each detected
   * anomaly, an existing open finding for the same (application, code, account,
   * entitlement) is updated in place (aturan 3), and only a genuinely new one is
   * inserted. SoD violations are keyed on (rule, employee) — one open conflict
   * per rule per person, so re-running detection does not multiply the seeded
   * finding into duplicates.
   */
  private async persist(
    snapshotId: string,
    applicationId: string,
    anomalies: readonly DetectedAnomaly[],
    sodViolations: readonly DetectedSodViolation[],
  ): Promise<DetectionOutcome> {
    let anomaliesOpened = 0
    let anomaliesCarriedForward = 0
    let sodViolationsOpened = 0

    await this.uow.write(async (tx, audit) => {
      const now = new Date()

      for (const anomaly of anomalies) {
        const carried = await this.upsertAnomaly(tx, applicationId, snapshotId, anomaly, now)
        if (carried) anomaliesCarriedForward += 1
        else anomaliesOpened += 1
      }

      for (const violation of sodViolations) {
        const opened = await this.insertSodViolationIfNew(tx, violation)
        if (opened) sodViolationsOpened += 1
      }

      // FR-B-007 aturan 1: AN-01 notifies immediately. The notification engine
      // (FR-X-010) is not built yet, so the immediate signal is the audit entry
      // and the finding's presence in the register, not a message — recorded
      // here so the gap is explicit rather than assumed handled.
      await audit.record({
        action: 'DETEKSI_ANOMALI',
        objectType: 'ACCESS_SNAPSHOT',
        objectId: snapshotId,
        after: {
          application_id: applicationId,
          anomalies_opened: anomaliesOpened,
          anomalies_carried_forward: anomaliesCarriedForward,
          sod_violations_opened: sodViolationsOpened,
        },
      })
    })

    if (anomaliesOpened + sodViolationsOpened > 0) {
      this.logger.log(
        `Detection on ${snapshotId}: ${anomaliesOpened} anomali baru, ` +
          `${sodViolationsOpened} pelanggaran SoD baru.`,
      )
    }

    return { snapshotId, anomaliesOpened, anomaliesCarriedForward, sodViolationsOpened }
  }

  /**
   * Returns true when an existing open finding was carried forward.
   *
   * The natural key — (application, code, account, entitlement) — lives partly
   * in `details` jsonb, because the migration keeps account/entitlement out of
   * the columns (Sec 17). Matching therefore reads `details->>'account_id'` and
   * `details->>'entitlement_code'` in raw SQL rather than as Prisma columns.
   */
  private async upsertAnomaly(
    tx: TransactionClient,
    applicationId: string,
    snapshotId: string,
    anomaly: DetectedAnomaly,
    now: Date,
  ): Promise<boolean> {
    const entitlementCode = anomalyEntitlementCode(anomaly)
    // The enum's stored Postgres value is hyphenated (AN-02) via @map, while the
    // Prisma identifier is AN_02. The raw cast must use the stored value.
    const dbCode = anomaly.code.replace('_', '-')
    const existing = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM public.access_anomaly
      WHERE application_id = ${applicationId}::uuid
        AND code = ${dbCode}::access_anomaly_code
        AND status = 'TERBUKA'
        AND COALESCE(details->>'account_id', '') = ${anomaly.accountId}
        AND COALESCE(details->>'entitlement_code', '') = ${entitlementCode}
      LIMIT 1
    `

    if (existing[0]) {
      await tx.accessAnomaly.update({
        where: { id: existing[0].id },
        // firstDetectedAt untouched (aturan 3): age is measured from first sight.
        data: { lastDetectedAt: now, snapshotId },
      })
      return true
    }

    await tx.accessAnomaly.create({
      data: {
        id: crypto.randomUUID(),
        snapshotId,
        snapshotLineId: anomaly.snapshotLineId,
        employeeId: anomaly.employeeId,
        applicationId,
        code: anomaly.code,
        severity: anomaly.severity,
        firstDetectedAt: now,
        lastDetectedAt: now,
        status: 'TERBUKA',
        // account_id and entitlement_code live in details, the natural key the
        // carry-forward lookup above reads back (migration Sec 17).
        details: { ...anomaly.details, account_id: anomaly.accountId },
      },
    })
    return false
  }

  /** Returns true when a new violation was inserted. */
  private async insertSodViolationIfNew(
    tx: TransactionClient,
    violation: DetectedSodViolation,
  ): Promise<boolean> {
    const existing = await tx.sodViolation.findFirst({
      where: { ruleId: violation.ruleId, employeeId: violation.employeeId, status: 'TERBUKA' },
      select: { id: true },
    })
    if (existing) return false

    await tx.sodViolation.create({
      data: {
        id: crypto.randomUUID(),
        ruleId: violation.ruleId,
        employeeId: violation.employeeId,
        entitlementIdA: violation.entitlementIdA,
        entitlementIdB: violation.entitlementIdB,
        detectedInSnapshotId: violation.detectedInSnapshotId,
        status: 'TERBUKA',
      },
    })
    return true
  }
}

/**
 * The account+entitlement key an anomaly is deduplicated on. AN-02 is per
 * account (no entitlement), so it carries an empty string, which is a stable
 * key rather than null — findFirst on a nullable column with null is a
 * different query.
 */
function anomalyEntitlementCode(anomaly: DetectedAnomaly): string {
  const code = anomaly.details['entitlement_code']
  return typeof code === 'string' ? code : ''
}
