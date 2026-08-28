import type { AccessAnomalyCode, RiskLevel } from '@prisma/client'

/**
 * Pure detection rules for FR-B-007 (access anomalies) and FR-B-024 (SoD).
 *
 * Deliberately free of Nest, Prisma and I/O — everything here is a pure
 * function over already-loaded rows, which is what makes the rules testable
 * without a database. The service layer does the reading and the writing; this
 * file only decides what counts as a finding.
 *
 * Two shapes of rule live here, and the split is not cosmetic:
 *
 * - Per-snapshot anomalies (AN-01, AN-02) look at one application's capture in
 *   isolation. An account active under a terminated employee, or an account
 *   nobody owns, is visible in the single snapshot that holds it.
 * - SoD (AN-08) is cross-application by definition (FR-B-024 aturan 1): the
 *   toxic combination is holding group A in one system and group B in another.
 *   It cannot be decided from one snapshot, so it takes an employee's complete
 *   current holdings and is evaluated per employee, not per snapshot line.
 *
 * AN-03 s.d. AN-07 are intentionally not implemented yet. They are named in the
 * return type's domain (the enum) but produced by nothing here — see the module
 * B service and the handoff for why, rather than being silently absent.
 */

/** One (account, entitlement) row of a snapshot, joined to its holder. */
export interface DetectionLine {
  readonly snapshotLineId: string
  readonly accountId: string
  readonly entitlementId: string
  readonly entitlementCode: string
  readonly isPrivileged: boolean
  /** null when the account maps to no employee (FR-B-006 aturan 4). */
  readonly employeeId: string | null
  /** The employee's HR status, null when the account is ownerless. */
  readonly employmentStatus: string | null
  /** The account's own status in the source application: AKTIF / NONAKTIF. */
  readonly accountStatus: string
}

export interface DetectedAnomaly {
  readonly code: AccessAnomalyCode
  readonly severity: RiskLevel
  /** null for findings that are about an account rather than one line. */
  readonly snapshotLineId: string | null
  readonly employeeId: string | null
  readonly accountId: string
  readonly details: Record<string, unknown>
}

const ACCOUNT_ACTIVE = 'AKTIF'
const EMPLOYMENT_ACTIVE = 'AKTIF'

/**
 * FR-B-007 · AN-01 and AN-02, from one application's snapshot.
 *
 * AN-01 (terminated but active) is raised once per line: a terminated employee
 * may hold several entitlements, and each is a separate thing to revoke. Its
 * severity is KRITIS and FR-B-007 aturan 1 makes it notify immediately, which
 * the service layer keys off the code.
 *
 * AN-02 (ownerless) is raised once per account, not once per line: "this
 * account maps to nobody" is a fact about the account, and emitting it for
 * every entitlement the account holds would turn one problem into ten.
 */
export function detectPerSnapshotAnomalies(lines: readonly DetectionLine[]): DetectedAnomaly[] {
  const anomalies: DetectedAnomaly[] = []
  const ownerlessAccountsSeen = new Set<string>()

  for (const line of lines) {
    // AN-01 — an active account whose employee is no longer active. Ownerless
    // accounts cannot be AN-01: there is no employment status to contradict.
    if (
      line.accountStatus === ACCOUNT_ACTIVE &&
      line.employeeId !== null &&
      line.employmentStatus !== null &&
      line.employmentStatus !== EMPLOYMENT_ACTIVE
    ) {
      anomalies.push({
        code: 'AN_01',
        severity: 'KRITIS',
        snapshotLineId: line.snapshotLineId,
        employeeId: line.employeeId,
        accountId: line.accountId,
        details: {
          entitlement_code: line.entitlementCode,
          employment_status: line.employmentStatus,
          account_status: line.accountStatus,
        },
      })
    }

    // AN-02 — the account maps to no employee, collapsed to one finding per
    // account regardless of how many entitlements it carries.
    if (line.employeeId === null && !ownerlessAccountsSeen.has(line.accountId)) {
      ownerlessAccountsSeen.add(line.accountId)
      anomalies.push({
        code: 'AN_02',
        severity: 'TINGGI',
        snapshotLineId: null,
        employeeId: null,
        accountId: line.accountId,
        details: { account_status: line.accountStatus },
      })
    }
  }

  return anomalies
}

/** A single SoD rule reduced to what evaluation needs. */
export interface SodRuleDef {
  readonly id: string
  readonly code: string
  readonly riskLevel: RiskLevel
  /** Entitlement ids that make up group A. */
  readonly groupA: ReadonlySet<string>
  /** Entitlement ids that make up group B. */
  readonly groupB: ReadonlySet<string>
}

/** One entitlement an employee currently holds, anywhere. */
export interface EmployeeHolding {
  readonly employeeId: string
  readonly entitlementId: string
  /** The snapshot this holding was observed in, recorded on the violation. */
  readonly snapshotId: string
}

export interface DetectedSodViolation {
  readonly ruleId: string
  readonly employeeId: string
  readonly entitlementIdA: string
  readonly entitlementIdB: string
  readonly detectedInSnapshotId: string
}

/**
 * FR-B-024 · evaluate SoD rules against employees' current holdings.
 *
 * A violation is one employee holding at least one entitlement from group A and
 * at least one from group B of the same rule. The specific pair recorded is the
 * first A crossed with the first B, so the finding names a concrete conflict
 * rather than an abstract "this person trips SOD-01" — the reviewer needs to see
 * which two entitlements to act on.
 *
 * `holdingsByEmployee` is every entitlement the employee holds across all
 * applications, which is what makes the cross-application rule (aturan 1)
 * expressible. Passing only one snapshot's lines would quietly reduce every
 * rule to the single-application check this module exists to surpass.
 */
export function evaluateSodRules(
  holdingsByEmployee: ReadonlyMap<string, readonly EmployeeHolding[]>,
  rules: readonly SodRuleDef[],
): DetectedSodViolation[] {
  const violations: DetectedSodViolation[] = []

  for (const [employeeId, holdings] of holdingsByEmployee) {
    const held = new Map<string, EmployeeHolding>()
    for (const h of holdings) held.set(h.entitlementId, h)

    for (const rule of rules) {
      const inA = [...held.keys()].filter((id) => rule.groupA.has(id)).sort()
      const inB = [...held.keys()].filter((id) => rule.groupB.has(id)).sort()
      if (inA.length === 0 || inB.length === 0) continue

      const entitlementIdA = inA[0]!
      const entitlementIdB = inB[0]!
      // The snapshot recorded is the one that carries the group-A holding: it is
      // the side that most often changes hands, and either side is a defensible
      // "detected in". Determinism matters more than the choice.
      const detectedInSnapshotId = held.get(entitlementIdA)!.snapshotId

      violations.push({
        ruleId: rule.id,
        employeeId,
        entitlementIdA,
        entitlementIdB,
        detectedInSnapshotId,
      })
    }
  }

  return violations
}

/**
 * Parse a stored SoD group (JSON) into a set of entitlement ids.
 *
 * The contract example uses `entitlement_ids` and the demo seed uses
 * `entitlement_codes`; both are accepted, and codes are resolved to ids through
 * the supplied lookup. A group that names a code with no catalogue entry drops
 * that code rather than failing the whole evaluation — a rule referring to an
 * entitlement that no longer exists should still catch the ones that do.
 */
export function resolveGroupEntitlementIds(
  group: unknown,
  codeToId: ReadonlyMap<string, string>,
): Set<string> {
  const ids = new Set<string>()
  if (group === null || typeof group !== 'object') return ids

  const record = group as Record<string, unknown>

  const rawIds = record.entitlement_ids
  if (Array.isArray(rawIds)) {
    for (const id of rawIds) if (typeof id === 'string') ids.add(id)
  }

  const rawCodes = record.entitlement_codes
  if (Array.isArray(rawCodes)) {
    for (const code of rawCodes) {
      if (typeof code !== 'string') continue
      const id = codeToId.get(code.toUpperCase())
      if (id) ids.add(id)
    }
  }

  return ids
}
