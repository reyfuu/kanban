import { describe, expect, it } from 'vitest'
import {
  detectPerSnapshotAnomalies,
  evaluateSodRules,
  resolveGroupEntitlementIds,
  type DetectionLine,
  type EmployeeHolding,
  type SodRuleDef,
} from '../src/modules/access/access-detection.js'

/**
 * The detection rules (FR-B-007, FR-B-024), tested as pure functions.
 *
 * These decide what counts as a finding; the persistence and carry-forward
 * halves live in detection.service.ts and are covered by the integration test.
 * Between them the feature is tested from both sides.
 */
function line(overrides: Partial<DetectionLine> = {}): DetectionLine {
  return {
    snapshotLineId: 'line-1',
    accountId: 'u-001',
    entitlementId: 'ent-1',
    entitlementCode: 'APP_ROLE',
    isPrivileged: false,
    employeeId: 'emp-1',
    employmentStatus: 'AKTIF',
    accountStatus: 'AKTIF',
    ...overrides,
  }
}

describe('FR-B-007 · AN-01 terminated but active', () => {
  it('TC-FN-B-100 · active account under a terminated employee is AN-01, KRITIS', () => {
    const anomalies = detectPerSnapshotAnomalies([
      line({ employmentStatus: 'TIDAK_AKTIF', accountStatus: 'AKTIF' }),
    ])
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]!.code).toBe('AN_01')
    expect(anomalies[0]!.severity).toBe('KRITIS')
    expect(anomalies[0]!.snapshotLineId).toBe('line-1')
  })

  it('TC-FN-B-101 · a NONAKTIF account under a terminated employee is not AN-01', () => {
    // The whole risk is an ACTIVE account outliving its holder. A disabled
    // account is the correct end state, not an anomaly.
    const anomalies = detectPerSnapshotAnomalies([
      line({ employmentStatus: 'TIDAK_AKTIF', accountStatus: 'NONAKTIF' }),
    ])
    expect(anomalies.filter((a) => a.code === 'AN_01')).toHaveLength(0)
  })

  it('TC-FN-B-102 · an active account under an active employee is clean', () => {
    expect(detectPerSnapshotAnomalies([line()])).toHaveLength(0)
  })

  it('TC-FN-B-103 · each entitlement of a terminated employee is its own AN-01', () => {
    const anomalies = detectPerSnapshotAnomalies([
      line({ snapshotLineId: 'l1', entitlementCode: 'ROLE_A', employmentStatus: 'TIDAK_AKTIF' }),
      line({ snapshotLineId: 'l2', entitlementCode: 'ROLE_B', employmentStatus: 'TIDAK_AKTIF' }),
    ])
    expect(anomalies.filter((a) => a.code === 'AN_01')).toHaveLength(2)
  })
})

describe('FR-B-007 · AN-02 ownerless account', () => {
  it('TC-FN-B-110 · an account mapping to no employee is AN-02, TINGGI', () => {
    const anomalies = detectPerSnapshotAnomalies([
      line({ employeeId: null, employmentStatus: null }),
    ])
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]!.code).toBe('AN_02')
    expect(anomalies[0]!.severity).toBe('TINGGI')
    expect(anomalies[0]!.employeeId).toBeNull()
  })

  it('TC-FN-B-111 · an ownerless account with two entitlements is one AN-02, not two', () => {
    // AN-02 is a fact about the account, not the line; emitting it per
    // entitlement would turn one problem into several.
    const anomalies = detectPerSnapshotAnomalies([
      line({ snapshotLineId: 'l1', entitlementCode: 'ROLE_A', employeeId: null, employmentStatus: null }),
      line({ snapshotLineId: 'l2', entitlementCode: 'ROLE_B', employeeId: null, employmentStatus: null }),
    ])
    expect(anomalies.filter((a) => a.code === 'AN_02')).toHaveLength(1)
  })

  it('TC-FN-B-112 · an ownerless account is not also AN-01', () => {
    // No employment status exists to contradict, so it cannot be terminated-but-active.
    const anomalies = detectPerSnapshotAnomalies([
      line({ employeeId: null, employmentStatus: null }),
    ])
    expect(anomalies.filter((a) => a.code === 'AN_01')).toHaveLength(0)
  })
})

describe('FR-B-024 · SoD evaluation', () => {
  const rule: SodRuleDef = {
    id: 'rule-1',
    code: 'SOD-01',
    riskLevel: 'KRITIS',
    groupA: new Set(['ent-order', 'ent-input']),
    groupB: new Set(['ent-approve']),
  }

  function holding(entitlementId: string, snapshotId = 'snap-1'): EmployeeHolding {
    return { employeeId: 'emp-1', entitlementId, snapshotId }
  }

  it('TC-FN-B-120 · holding group A and group B is a violation', () => {
    const holdings = new Map<string, EmployeeHolding[]>([
      ['emp-1', [holding('ent-order'), holding('ent-approve')]],
    ])
    const violations = evaluateSodRules(holdings, [rule])
    expect(violations).toHaveLength(1)
    expect(violations[0]!.entitlementIdA).toBe('ent-order')
    expect(violations[0]!.entitlementIdB).toBe('ent-approve')
  })

  it('TC-FN-B-121 · holding only group A is not a violation', () => {
    const holdings = new Map<string, EmployeeHolding[]>([['emp-1', [holding('ent-order')]]])
    expect(evaluateSodRules(holdings, [rule])).toHaveLength(0)
  })

  it('TC-FN-B-122 · the violation is cross-application via separate snapshots', () => {
    // Group A observed in one application's snapshot, group B in another's:
    // the toxic pair is only visible when holdings are pooled per employee.
    const holdings = new Map<string, EmployeeHolding[]>([
      ['emp-1', [holding('ent-order', 'snap-trading'), holding('ent-approve', 'snap-backoffice')]],
    ])
    const violations = evaluateSodRules(holdings, [rule])
    expect(violations).toHaveLength(1)
    expect(violations[0]!.detectedInSnapshotId).toBe('snap-trading')
  })

  it('TC-FN-B-123 · two employees each holding the pair produce two violations', () => {
    const holdings = new Map<string, EmployeeHolding[]>([
      ['emp-1', [holding('ent-order'), holding('ent-approve')]],
      ['emp-2', [{ employeeId: 'emp-2', entitlementId: 'ent-input', snapshotId: 's' },
                 { employeeId: 'emp-2', entitlementId: 'ent-approve', snapshotId: 's' }]],
    ])
    expect(evaluateSodRules(holdings, [rule])).toHaveLength(2)
  })

  it('TC-FN-B-124 · the recorded pair is deterministic under reordering', () => {
    const a = evaluateSodRules(
      new Map([['emp-1', [holding('ent-input'), holding('ent-order'), holding('ent-approve')]]]),
      [rule],
    )
    const b = evaluateSodRules(
      new Map([['emp-1', [holding('ent-approve'), holding('ent-order'), holding('ent-input')]]]),
      [rule],
    )
    expect(a[0]!.entitlementIdA).toBe(b[0]!.entitlementIdA)
    expect(a[0]!.entitlementIdB).toBe(b[0]!.entitlementIdB)
  })
})

describe('resolveGroupEntitlementIds', () => {
  const codeToId = new Map([
    ['TRD_ORDER_ENTRY', 'id-order'],
    ['BO_SETTLE_APPROVE', 'id-approve'],
  ])

  it('TC-FN-B-130 · resolves entitlement_codes to ids, uppercasing', () => {
    const ids = resolveGroupEntitlementIds({ entitlement_codes: ['trd_order_entry'] }, codeToId)
    expect([...ids]).toEqual(['id-order'])
  })

  it('TC-FN-B-131 · accepts entitlement_ids directly', () => {
    const ids = resolveGroupEntitlementIds({ entitlement_ids: ['id-approve'] }, codeToId)
    expect([...ids]).toEqual(['id-approve'])
  })

  it('TC-FN-B-132 · drops unknown codes rather than failing', () => {
    const ids = resolveGroupEntitlementIds({ entitlement_codes: ['NOPE', 'TRD_ORDER_ENTRY'] }, codeToId)
    expect([...ids]).toEqual(['id-order'])
  })

  it('TC-FN-B-133 · a non-object group yields an empty set', () => {
    expect(resolveGroupEntitlementIds(null, codeToId).size).toBe(0)
    expect(resolveGroupEntitlementIds('nope', codeToId).size).toBe(0)
  })
})
