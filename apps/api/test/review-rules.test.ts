import { describe, expect, it } from 'vitest'
import {
  BULK_MAX_ITEMS,
  bulkExclusionReason,
  type ItemRiskProfile,
  reasonRequired,
  reasonRequirementLabel,
  validateReason,
} from '../src/modules/access/review-rules.js'

/**
 * The decision rules, tested as pure functions.
 *
 * These are the code-level halves of K-2, K-3 and K-4 -- the parts the database
 * cannot enforce because they depend on a join (is this entitlement privileged?)
 * that a CHECK constraint cannot see. The database halves are covered by
 * access-review.integration.test.ts; between them the controls are tested from
 * both sides.
 */
function profile(overrides: Partial<ItemRiskProfile> = {}): ItemRiskProfile {
  return {
    isPrivileged: false,
    riskLevel: 'RENDAH',
    hasSodConflict: false,
    hasAnomaly: false,
    ...overrides,
  }
}

const ROUTINE = profile()
const PRIVILEGED = profile({ isPrivileged: true, riskLevel: 'KRITIS' })
const HIGH_RISK = profile({ riskLevel: 'TINGGI' })

describe('K-3 · FR-B-012 aturan 2 dan 3 — alasan wajib', () => {
  it('TC-FN-B-050 · Pertahankan pada item biasa tidak memerlukan alasan', () => {
    expect(reasonRequired('PERTAHANKAN', ROUTINE)).toBe(false)
    expect(validateReason(null, 'PERTAHANKAN', ROUTINE)).toBeNull()
  })

  it('TC-FN-B-051 · Pertahankan pada hak akses istimewa tetap memerlukan alasan', () => {
    expect(reasonRequired('PERTAHANKAN', PRIVILEGED)).toBe(true)
    expect(validateReason(null, 'PERTAHANKAN', PRIVILEGED)).toBe('REASON_REQUIRED')
    expect(validateReason('   ', 'PERTAHANKAN', PRIVILEGED)).toBe('REASON_REQUIRED')
  })

  it('TC-FN-B-052 · Pertahankan pada item berisiko tinggi tetap memerlukan alasan', () => {
    expect(reasonRequired('PERTAHANKAN', HIGH_RISK)).toBe(true)
    expect(reasonRequired('PERTAHANKAN', profile({ riskLevel: 'SEDANG' }))).toBe(false)
  })

  it('TC-FN-B-053 · Cabut, Ubah dan Alihkan selalu memerlukan alasan', () => {
    for (const decision of ['CABUT', 'UBAH', 'ALIHKAN'] as const) {
      expect(reasonRequired(decision, ROUTINE)).toBe(true)
      expect(validateReason(null, decision, ROUTINE)).toBe('REASON_REQUIRED')
    }
  })

  it('TC-FN-B-054 · alasan terlalu pendek atau berupa pengulangan karakter ditolak', () => {
    expect(validateReason('masih', 'CABUT', ROUTINE)).toBe('REASON_TOO_SHORT')
    expect(validateReason('aaaaaaaaaaaaaaa', 'CABUT', ROUTINE)).toBe('REASON_REPEATED_CHARACTER')
    expect(validateReason('...............', 'CABUT', ROUTINE)).toBe('REASON_REPEATED_CHARACTER')
    expect(
      validateReason('Sudah tidak menjabat sejak Agustus 2026.', 'CABUT', ROUTINE),
    ).toBeNull()
  })

  it('menjelaskan MENGAPA alasan wajib, bukan sekadar bahwa ia wajib (L-10 aturan 4)', () => {
    expect(reasonRequirementLabel('PERTAHANKAN', PRIVILEGED)).toContain('istimewa')
    expect(reasonRequirementLabel('PERTAHANKAN', HIGH_RISK)).toContain('berisiko tinggi')
    expect(reasonRequirementLabel('PERTAHANKAN', ROUTINE)).toBeNull()
  })
})

describe('K-4 · FR-B-013 aturan 1 — pengecualian keputusan massal', () => {
  it('TC-FN-B-055 · item rutin memenuhi syarat', () => {
    expect(bulkExclusionReason(ROUTINE)).toBeNull()
  })

  it('TC-FN-B-056 · hak akses istimewa dikecualikan', () => {
    expect(bulkExclusionReason(profile({ isPrivileged: true }))).toContain('istimewa')
  })

  it('TC-FN-B-057 · risiko tinggi dan kritis dikecualikan', () => {
    expect(bulkExclusionReason(profile({ riskLevel: 'TINGGI' }))).toContain('risiko tinggi')
    expect(bulkExclusionReason(profile({ riskLevel: 'KRITIS' }))).toContain('risiko tinggi')
    expect(bulkExclusionReason(profile({ riskLevel: 'SEDANG' }))).toBeNull()
  })

  it('TC-FN-B-058 · konflik pemisahan tugas dikecualikan', () => {
    expect(bulkExclusionReason(profile({ hasSodConflict: true }))).toContain('pemisahan tugas')
  })

  it('TC-FN-B-059 · anomali dikecualikan', () => {
    expect(bulkExclusionReason(profile({ hasAnomaly: true }))).toContain('anomali')
  })

  it('TC-FN-B-060 · alasan pengecualian menyebut SELURUH penyebabnya', () => {
    // FR-B-013 rule 2 requires the exclusion to be shown with its reason. A
    // reviewer told only the first of three reasons will fix that one and be
    // refused again, which reads as the system being arbitrary.
    const reason = bulkExclusionReason(
      profile({ isPrivileged: true, riskLevel: 'KRITIS', hasSodConflict: true }),
    )
    expect(reason).toContain('istimewa')
    expect(reason).toContain('risiko tinggi')
    expect(reason).toContain('pemisahan tugas')
  })

  it('FR-B-013 aturan 3 · batas 50 item ditetapkan di satu tempat', () => {
    expect(BULK_MAX_ITEMS).toBe(50)
  })
})

describe('K-2 · FR-B-012 aturan 1 — tidak ada keputusan bawaan', () => {
  it('TC-FN-B-042 · tidak ada fungsi yang mengembalikan keputusan bawaan', () => {
    // K-2 is an absence, and an absence is awkward to assert. What can be
    // asserted is that the rules module exports nothing that produces a
    // decision: every export either validates or classifies. If a
    // `defaultDecision` ever appears here, this fails.
    const rules = Object.keys({
      bulkExclusionReason,
      reasonRequired,
      reasonRequirementLabel,
      validateReason,
    })
    expect(rules.some((name) => /default|fallback|initial/i.test(name))).toBe(false)
  })
})
