import { describe, expect, it } from 'vitest'
import { computeFlaggedReviewers } from '../src/modules/access/evidence-package.service.js'

/**
 * FR-B-014 · the rubber-stamp detector, as a pure function over decision rows.
 *
 * Only indicators 1 (all-retain, >20 items, <15s each) and 3 (identical reason)
 * are computable from what the API records; indicator 2 needs UI telemetry and
 * is deliberately not asserted. These tests pin the boundaries so a later edit
 * cannot loosen them without a failing test -- a false flag erodes trust as
 * much as a missed one.
 */

function rows(
  n: number,
  opts: { decision?: string; reason?: string | null; seconds: number; reviewer?: string },
): {
  reviewer_id: string
  reviewer_name: string | null
  reviewer_external_id: string
  decision: string | null
  reason: string | null
  seconds_spent: number | null
}[] {
  return Array.from({ length: n }, () => ({
    reviewer_id: opts.reviewer ?? 'r1',
    reviewer_name: 'Reviewer Satu',
    reviewer_external_id: 'reviewer.satu',
    decision: opts.decision ?? 'PERTAHANKAN',
    reason: opts.reason ?? null,
    seconds_spent: opts.seconds,
  }))
}

describe('computeFlaggedReviewers · FR-B-014', () => {
  it('flags all-retain, more than 20 items, under 15s per item (indicator 1)', () => {
    const flagged = computeFlaggedReviewers(rows(25, { seconds: 5 }))
    expect(flagged).toHaveLength(1)
    expect(flagged[0]!.indicators.join(' ')).toMatch(/indikator 1/)
  })

  it('does not flag when exactly 20 items (boundary: needs more than 20)', () => {
    const flagged = computeFlaggedReviewers(rows(20, { seconds: 5 }))
    expect(flagged.filter((f) => f.indicators.some((i) => i.includes('indikator 1')))).toHaveLength(0)
  })

  it('does not flag on speed alone when a decision is not PERTAHANKAN', () => {
    const list = [...rows(24, { seconds: 2 }), ...rows(1, { decision: 'CABUT', reason: 'Alasan pencabutan yang memadai.', seconds: 2 })]
    const flagged = computeFlaggedReviewers(list)
    expect(flagged.filter((f) => f.indicators.some((i) => i.includes('indikator 1')))).toHaveLength(0)
  })

  it('flags an identical non-empty reason across every item (indicator 3)', () => {
    const flagged = computeFlaggedReviewers(rows(3, { seconds: 300, reason: 'Sama untuk semua.' }))
    expect(flagged[0]!.indicators.join(' ')).toMatch(/indikator 3/)
  })

  it('does not flag identical-reason when reasons are empty', () => {
    const flagged = computeFlaggedReviewers(rows(3, { seconds: 300, reason: '' }))
    expect(flagged).toHaveLength(0)
  })

  it('keeps reviewers independent', () => {
    const list = [
      ...rows(25, { seconds: 3, reviewer: 'fast' }),
      ...rows(25, { seconds: 300, reviewer: 'slow' }),
    ]
    const flagged = computeFlaggedReviewers(list)
    expect(flagged.map((f) => f.reviewer_id)).toEqual(['fast'])
  })
})
