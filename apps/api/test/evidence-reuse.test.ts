import { describe, expect, it } from 'vitest'
import {
  coversPeriod,
  isExpired,
  relevanceScore,
  type Period,
} from '../src/modules/evidence/evidence-reuse-rules.js'

/**
 * FR-A-012 · reusing evidence across requests.
 *
 * These are the rules an auditor would argue about in a review meeting, so they
 * are tested against the wording of the FRD rather than against the
 * implementation. The one that matters most is rule 2: evidence whose validity
 * window does not cover the audited period does not substantiate that period,
 * and accepting it silently produces an audit file that looks complete and is
 * not.
 */

const d = (s: string) => new Date(`${s}T00:00:00.000Z`)

describe('FR-A-012 aturan 2 · cakupan periode', () => {
  const q2: Period = { from: d('2026-04-01'), to: d('2026-06-30') }

  it('menerima bukti yang mencakup seluruh periode', () => {
    expect(coversPeriod({ from: d('2026-01-01'), to: d('2026-12-31') }, q2).covered).toBe(true)
  })

  it('menerima bukti dengan batas persis sama', () => {
    expect(coversPeriod({ from: d('2026-04-01'), to: d('2026-06-30') }, q2).covered).toBe(true)
  })

  it('MENOLAK bukti yang baru mulai berlaku di tengah periode', () => {
    // Inti aturannya: daftar akses per Mei tidak menunjukkan siapa yang punya
    // akses di bulan April.
    const v = coversPeriod({ from: d('2026-05-01'), to: d('2026-12-31') }, q2)
    expect(v.covered).toBe(false)
    if (!v.covered) expect(v.reason).toContain('2026-05-01')
  })

  it('MENOLAK bukti yang berakhir sebelum periode selesai', () => {
    const v = coversPeriod({ from: d('2026-01-01'), to: d('2026-05-31') }, q2)
    expect(v.covered).toBe(false)
    if (!v.covered) expect(v.reason).toContain('2026-05-31')
  })

  it('MENOLAK tumpang tindih sebagian — cakupan harus utuh, bukan beririsan', () => {
    // Kalau irisan dianggap cukup, sebuah berkas audit bisa lolos dengan bukti
    // satu minggu untuk periode satu kuartal.
    expect(coversPeriod({ from: d('2026-06-25'), to: d('2026-07-10') }, q2).covered).toBe(false)
  })

  it('batas terbuka pada bukti berarti tak terbatas, jadi mencakup', () => {
    expect(coversPeriod({ from: null, to: null }, q2).covered).toBe(true)
    expect(coversPeriod({ from: null, to: d('2026-12-31') }, q2).covered).toBe(true)
  })

  it('batas terbuka pada permintaan berarti sisi itu tidak dibatasi', () => {
    const openEnded: Period = { from: d('2026-04-01'), to: null }
    expect(coversPeriod({ from: d('2026-01-01'), to: d('2026-04-02') }, openEnded).covered).toBe(
      true,
    )
  })
})

describe('FR-A-012 aturan 3 · bukti kedaluwarsa', () => {
  const asOf = d('2026-08-28')

  it('menandai bukti yang masa berlakunya sudah lewat', () => {
    expect(isExpired({ from: d('2025-01-01'), to: d('2026-06-30') }, asOf)).toBe(true)
  })

  it('tidak menandai bukti yang masih berlaku', () => {
    expect(isExpired({ from: d('2026-01-01'), to: d('2026-12-31') }, asOf)).toBe(false)
  })

  it('bukti tanpa tanggal akhir tidak pernah kedaluwarsa', () => {
    expect(isExpired({ from: d('2020-01-01'), to: null }, asOf)).toBe(false)
  })
})

describe('FR-A-012 aturan 1 · peringkat saran', () => {
  const request = {
    controlId: 'ctrl-1',
    responsibleOrgUnitId: 'unit-1',
    period: { from: d('2026-04-01'), to: d('2026-06-30') },
  }
  const covering: Period = { from: d('2026-01-01'), to: d('2026-12-31') }

  it('kontrol yang sama menang atas unit yang sama', () => {
    // Dua bukti untuk kontrol yang sama membahas kewajiban yang sama; dua bukti
    // dari unit yang sama bisa saja tidak berhubungan sama sekali.
    const sameControl = relevanceScore(
      { controlId: 'ctrl-1', ownerOrgUnitId: 'unit-lain', period: covering },
      request,
    )
    const sameUnit = relevanceScore(
      { controlId: 'ctrl-lain', ownerOrgUnitId: 'unit-1', period: covering },
      request,
    )
    expect(sameControl).toBeGreaterThan(sameUnit)
  })

  it('cakupan periode menaikkan peringkat, bukan menyingkirkan', () => {
    // Disaring, bukan dinilai, berarti auditor tak pernah melihat bukti yang
    // nyaris cocok dan tak bisa memakai pertimbangannya sendiri.
    const notCovering: Period = { from: d('2026-05-01'), to: d('2026-12-31') }
    const withPeriod = relevanceScore(
      { controlId: 'ctrl-1', ownerOrgUnitId: null, period: covering },
      request,
    )
    const withoutPeriod = relevanceScore(
      { controlId: 'ctrl-1', ownerOrgUnitId: null, period: notCovering },
      request,
    )
    expect(withPeriod).toBeGreaterThan(withoutPeriod)
    expect(withoutPeriod).toBeGreaterThan(0)
  })

  it('tanpa sinyal apa pun skornya nol sehingga tidak disarankan', () => {
    expect(
      relevanceScore(
        { controlId: 'ctrl-lain', ownerOrgUnitId: 'unit-lain', period: { from: d('2026-05-01'), to: d('2026-05-02') } },
        request,
      ),
    ).toBe(0)
  })
})
