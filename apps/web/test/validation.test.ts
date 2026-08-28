import { describe, expect, it } from 'vitest'
import { isReasonComplete, MIN_REASON_LENGTH } from '../src/components/validation'

/**
 * The required-reason rule.
 *
 * Tested as a pure function because that is the part that decides anything.
 * What this does NOT cover, stated plainly rather than implied: whether the
 * hint actually renders when the form opens. That needs a browser, and there
 * is no browser test harness in this repo -- adding one for a single component
 * would be a larger commitment than the check is worth. The rule below is the
 * thing that would break silently; the rendering is visible the first time
 * anyone opens the form.
 */
describe('FR-B-020 / FR-C-005 aturan 3 · panjang alasan minimum', () => {
  it('menolak alasan yang terlalu pendek', () => {
    expect(isReasonComplete('')).toBe(false)
    expect(isReasonComplete('ok')).toBe(false)
    // Nine characters: one short, which is exactly where an off-by-one lives.
    expect(isReasonComplete('123456789')).toBe(false)
  })

  it('menerima tepat pada batas', () => {
    expect(isReasonComplete('1234567890')).toBe(true)
    expect(MIN_REASON_LENGTH).toBe(10)
  })

  it('spasi tidak dihitung sebagai alasan', () => {
    // The failure this prevents: a field satisfied by holding down the space
    // bar, which would pass a naive length check and record nothing.
    expect(isReasonComplete('          ')).toBe(false)
    expect(isReasonComplete('   ok   ')).toBe(false)
  })

  it('memangkas spasi tepi sebelum mengukur', () => {
    expect(isReasonComplete('  akses sudah dicabut  ')).toBe(true)
  })
})
