import type { ReviewDecisionType, RiskLevel } from '@prisma/client'

/**
 * The properties of a review item that decide what a reviewer is allowed to do
 * with it. Resolved from the entitlement catalogue and the findings attached to
 * the item -- never supplied by the client.
 */
export interface ItemRiskProfile {
  readonly isPrivileged: boolean
  readonly riskLevel: RiskLevel
  readonly hasSodConflict: boolean
  readonly hasAnomaly: boolean
}

export const HIGH_RISK_LEVELS: readonly RiskLevel[] = ['KRITIS', 'TINGGI']

export function isHighRisk(profile: ItemRiskProfile): boolean {
  return HIGH_RISK_LEVELS.includes(profile.riskLevel)
}

/**
 * FR-B-012 rule 3 -- K-3.
 *
 * Cabut, Ubah and Alihkan always need a reason; the database enforces that much
 * on its own. What the database cannot see is whether the entitlement behind
 * this item is privileged or high risk, because that lives one join away. So
 * the "Pertahankan still needs a reason" half of K-3 is enforced here, and this
 * is the only place it is enforced -- which is why it takes a resolved profile
 * rather than anything a caller could assert.
 */
export function reasonRequired(decision: ReviewDecisionType, profile: ItemRiskProfile): boolean {
  if (decision !== 'PERTAHANKAN') return true
  return profile.isPrivileged || isHighRisk(profile)
}

/** Why the reason box says "wajib — hak akses istimewa" rather than showing an asterisk (L-10 rule 4). */
export function reasonRequirementLabel(
  decision: ReviewDecisionType,
  profile: ItemRiskProfile,
): string | null {
  if (!reasonRequired(decision, profile)) return null
  if (decision !== 'PERTAHANKAN') return 'wajib — keputusan selain Pertahankan'
  if (profile.isPrivileged) return 'wajib — hak akses istimewa'
  return 'wajib — hak akses berisiko tinggi'
}

export const REASON_MIN_LENGTH = 10

export type ReasonProblem = 'REASON_REQUIRED' | 'REASON_TOO_SHORT' | 'REASON_REPEATED_CHARACTER'

/**
 * FR-B-012 rule 2, mirroring chk_review_decision_reason_format.
 *
 * Deliberately duplicated between here and the CHECK constraint. The database
 * copy is the one that cannot be bypassed; this one exists so the reviewer gets
 * a field-level message naming what is wrong instead of a 500 from a constraint
 * violation. If the two ever disagree, the database wins and the user sees an
 * error they cannot act on -- so they are written to the same rule, and the
 * integration test asserts both reject the same inputs.
 */
export function validateReason(
  reason: string | null | undefined,
  decision: ReviewDecisionType,
  profile: ItemRiskProfile,
): ReasonProblem | null {
  const trimmed = reason?.trim() ?? ''

  if (trimmed.length === 0) return reasonRequired(decision, profile) ? 'REASON_REQUIRED' : null
  if (trimmed.length < REASON_MIN_LENGTH) return 'REASON_TOO_SHORT'
  // "aaaaaaaaaaaaaaa" passes a length check and says nothing. The database
  // regex is ^(.)\1*$ over the untrimmed value; this is the same test.
  if (/^(.)\1*$/u.test(reason ?? '')) return 'REASON_REPEATED_CHARACTER'

  return null
}

export const REASON_MESSAGES: Record<ReasonProblem, string> = {
  REASON_REQUIRED: `Alasan wajib diisi minimal ${REASON_MIN_LENGTH} karakter.`,
  REASON_TOO_SHORT: `Alasan wajib diisi minimal ${REASON_MIN_LENGTH} karakter.`,
  REASON_REPEATED_CHARACTER: 'Alasan tidak boleh berupa pengulangan karakter yang sama.',
}

/**
 * FR-B-013 rule 1 -- K-4.
 *
 * Returns the reason an item is barred from bulk decisions, or null when it may
 * take part. Phrased as "why not" rather than a boolean because rule 2 requires
 * the exclusion to be shown to the reviewer with its reason: an item that
 * silently disappears from a bulk selection teaches reviewers that the feature
 * is unreliable, and an item that appears and is then rejected teaches them to
 * resent it.
 *
 * This is recomputed on the server for every item in a bulk request. The
 * `bulk_eligible` flag in the list response is a rendering hint, and a rendering
 * hint is not a control -- a client that ignores it must still be refused.
 */
export function bulkExclusionReason(profile: ItemRiskProfile): string | null {
  const causes: string[] = []
  if (profile.isPrivileged) causes.push('hak akses istimewa')
  if (isHighRisk(profile)) causes.push('risiko tinggi')
  if (profile.hasSodConflict) causes.push('konflik pemisahan tugas')
  if (profile.hasAnomaly) causes.push('anomali terdeteksi')

  if (causes.length === 0) return null

  const list = causes.length === 1 ? causes[0]! : `${causes.slice(0, -1).join(', ')} dan ${causes.at(-1)}`
  return `Item ini harus diputuskan satu per satu: ${list}.`
}

/** FR-B-013 rule 3. */
export const BULK_MAX_ITEMS = 50

/** FR-B-012 rule 4 -- after two reassignments the item escalates instead. */
export const MAX_REASSIGNMENTS = 2
