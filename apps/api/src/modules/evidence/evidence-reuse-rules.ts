/**
 * FR-A-012 · rules for reusing existing evidence on a new request.
 *
 * Kept as pure functions, separate from the service, for the same reason
 * `review-rules.ts` and `document-rules.ts` are: these are the rules an auditor
 * would argue about, and they should be readable and testable without a
 * database, a principal, or a transaction in the way.
 *
 * The rule that carries real weight is rule 2. Evidence whose validity window
 * does not cover the period being audited is, for audit purposes, evidence
 * about a different thing -- an access list from March does not show who had
 * access in June. Linking it anyway is not a small filing error; it produces an
 * audit file that looks complete and is not, and the discrepancy typically
 * surfaces when a regulator asks the question the evidence was supposed to
 * answer. So the default is refusal, with a deliberate, attributed, and
 * reason-bearing override for the case where an auditor judges it acceptable.
 */

/** A validity window. Open ends mean "not bounded on that side". */
export interface Period {
  readonly from: Date | null
  readonly to: Date | null
}

export type PeriodVerdict =
  | { readonly covered: true }
  | { readonly covered: false; readonly reason: string }

/**
 * Does `evidence` cover the whole of `requested`?
 *
 * Coverage must be total, not overlapping. Evidence valid for the first week of
 * a quarter does not substantiate the quarter, and treating partial overlap as
 * sufficient is how a file ends up with a gap nobody notices until it matters.
 *
 * An absent bound on the evidence side means unbounded, so it covers. An absent
 * bound on the request side means the request does not constrain that edge.
 */
export function coversPeriod(evidence: Period, requested: Period): PeriodVerdict {
  if (requested.from && evidence.from && evidence.from > requested.from) {
    return {
      covered: false,
      reason: `Bukti baru berlaku sejak ${iso(evidence.from)}, sedangkan periode yang diminta dimulai ${iso(requested.from)}.`,
    }
  }
  if (requested.to && evidence.to && evidence.to < requested.to) {
    return {
      covered: false,
      reason: `Bukti berakhir masa berlakunya ${iso(evidence.to)}, sedangkan periode yang diminta berakhir ${iso(requested.to)}.`,
    }
  }
  return { covered: true }
}

/**
 * FR-A-012 rule 3 · evidence past its validity window is expired.
 *
 * Expired evidence is excluded from suggestions but is NOT blocked from being
 * linked deliberately: rule 3 speaks about what the system offers, and rule 2
 * governs what it accepts. Conflating the two would make an auditor's
 * documented override impossible to carry out for exactly the evidence that
 * most often needs one.
 */
export function isExpired(evidence: Period, asOf: Date): boolean {
  return evidence.to !== null && evidence.to < asOf
}

/**
 * Relevance score for FR-A-012 rule 1's suggestions, highest first.
 *
 * Ordered by how strongly each signal implies "this is evidence for that
 * request", which is why the control match outweighs the rest: two pieces of
 * evidence for the same control are about the same obligation, whereas two from
 * the same unit may have nothing to do with each other. Period coverage is
 * scored rather than filtered so an auditor can still see a near-miss and make
 * the judgement themselves.
 */
export interface Suggestable {
  readonly controlId: string | null
  readonly ownerOrgUnitId: string | null
  readonly period: Period
}

export interface RequestContext {
  readonly controlId: string | null
  readonly responsibleOrgUnitId: string | null
  readonly period: Period
}

export function relevanceScore(
  candidate: Suggestable,
  request: RequestContext,
): number {
  let score = 0
  if (request.controlId && candidate.controlId === request.controlId) score += 100
  if (
    request.responsibleOrgUnitId &&
    candidate.ownerOrgUnitId === request.responsibleOrgUnitId
  ) {
    score += 10
  }
  if (coversPeriod(candidate.period, request.period).covered) score += 5
  return score
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}
