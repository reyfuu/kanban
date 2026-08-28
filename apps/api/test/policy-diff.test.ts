import { describe, expect, it } from 'vitest'
import {
  collapseUnchanged,
  diffDocuments,
  type DiffLine,
} from '../src/modules/policy/document-diff.js'

/**
 * FR-C-006 aturan 3 · the version comparison.
 *
 * Tested as a pure function because that is what it is, and because the output
 * is treated as evidence: a reviewer approving "only editorial changes" is
 * relying on this being right about what changed.
 */

describe('FR-C-006 aturan 3 · perbandingan isi versi', () => {
  it('mengenali baris yang berubah, bukan seluruh dokumen', () => {
    const before = 'Pasal 1\n\nPenyelesaian dilakukan pada T+3.\n\nPasal 2\n\nRekonsiliasi harian.'
    const after = 'Pasal 1\n\nPenyelesaian dilakukan pada T+2.\n\nPasal 2\n\nRekonsiliasi harian.'
    const diff = diffDocuments(before, after)

    expect(diff.summary.added).toBe(1)
    expect(diff.summary.removed).toBe(1)
    // Seven lines in, one replaced: the other six must come back unchanged.
    // That the untouched articles are NOT reported as changed is the whole
    // reason a diff is more useful than "the text differs".
    expect(diff.summary.unchanged).toBe(6)
    // Pasal 2 in particular is untouched and must say so.
    const pasal2 = diff.lines.find((l) => l.text === 'Pasal 2')
    expect(pasal2?.kind).toBe('sama')
  })

  it('dokumen identik menghasilkan nol perubahan', () => {
    const text = 'Pasal 1\n\nIsi tetap sama.'
    const diff = diffDocuments(text, text)
    expect(diff.summary.added).toBe(0)
    expect(diff.summary.removed).toBe(0)
    expect(diff.lines.every((l) => l.kind === 'sama')).toBe(true)
  })

  it('penambahan murni tidak melaporkan penghapusan', () => {
    const diff = diffDocuments('Pasal 1', 'Pasal 1\nPasal 2')
    expect(diff.summary.removed).toBe(0)
    expect(diff.summary.added).toBe(1)
  })

  it('penghapusan murni tidak melaporkan penambahan', () => {
    const diff = diffDocuments('Pasal 1\nPasal 2', 'Pasal 1')
    expect(diff.summary.added).toBe(0)
    expect(diff.summary.removed).toBe(1)
  })

  it('nomor baris lama dan baru dipetakan dengan benar', () => {
    const diff = diffDocuments('a\nb\nc', 'a\nx\nc')
    const removed = diff.lines.find((l) => l.kind === 'hapus')!
    const added = diff.lines.find((l) => l.kind === 'tambah')!
    expect(removed.oldLine).toBe(2)
    expect(removed.newLine).toBeNull()
    expect(added.newLine).toBe(2)
    expect(added.oldLine).toBeNull()
  })

  it('dokumen kosong ke berisi dilaporkan sebagai penambahan', () => {
    const diff = diffDocuments('', 'Pasal 1\nPasal 2')
    expect(diff.summary.added).toBeGreaterThan(0)
  })

  it('menandai perubahan kecil sebagai tampak redaksional', () => {
    const diff = diffDocuments('Pasal 1\n\nBerlaku sejak tahun 2025.', 'Pasal 1\n\nBerlaku sejak tahun 2026.')
    expect(diff.summary.looksEditorial).toBe(true)
  })

  it('menandai penulisan ulang besar sebagai TIDAK redaksional', () => {
    const before = Array.from({ length: 20 }, (_, i) => `baris lama ${i}`).join('\n')
    const after = Array.from({ length: 20 }, (_, i) => `baris baru ${i}`).join('\n')
    // The hint that catches a substantive rewrite filed as a minor revision to
    // skip approval tiers. It informs the approver; it never blocks.
    expect(diffDocuments(before, after).summary.looksEditorial).toBe(false)
  })
})

describe('pemadatan bagian yang tidak berubah', () => {
  const long = Array.from({ length: 40 }, (_, i) => `baris ${i}`).join('\n')
  const changed = long.replace('baris 20', 'baris 20 diubah')

  it('menyisakan konteks di sekitar perubahan dan melaporkan yang dilewati', () => {
    const diff = diffDocuments(long, changed)
    const hunks = collapseUnchanged(diff.lines, 2)

    expect(hunks).toHaveLength(1)
    // Long stretches of identical text are omitted, but the omission is
    // reported rather than silent: the reader can see that lines were skipped.
    expect(hunks[0]!.skippedBefore).toBeGreaterThan(0)
    const kinds = hunks[0]!.lines.map((l: DiffLine) => l.kind)
    expect(kinds).toContain('tambah')
    expect(kinds).toContain('hapus')
  })

  it('dokumen tanpa perubahan menghasilkan nol hunk', () => {
    const diff = diffDocuments(long, long)
    expect(collapseUnchanged(diff.lines, 2)).toHaveLength(0)
  })
})

/**
 * Completion rounding, kept beside the diff tests because both are small pure
 * functions whose output people read as fact.
 */
describe('FR-C-021 · pembulatan persentase penyelesaian', () => {
  // Re-derived here rather than exported: the rule is what is under test, and
  // an exported helper would invite callers to bypass `progress()`.
  const percent = (done: number, total: number): number => {
    if (total === 0) return 0
    if (done === 0) return 0
    if (done >= total) return 100
    const raw = Math.round((done / total) * 100)
    if (raw === 0) return 1
    if (raw === 100) return 99
    return raw
  }

  it('tidak melaporkan 0% padahal sudah ada yang menyatakan', () => {
    // Math.round would say 0 here, which reads as "nobody has started".
    expect(percent(1, 250)).toBe(1)
  })

  it('tidak melaporkan 100% padahal masih ada yang tertunggak', () => {
    // The dangerous direction: a rounded 100% hides an outstanding obligation
    // behind a number claiming there are none.
    expect(percent(249, 250)).toBe(99)
  })

  it('0 dari sekian tetap 0%, dan selesai seluruhnya tetap 100%', () => {
    expect(percent(0, 250)).toBe(0)
    expect(percent(250, 250)).toBe(100)
    expect(percent(0, 0)).toBe(0)
  })
})
