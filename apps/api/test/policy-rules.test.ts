import { describe, expect, it } from 'vitest'
import {
  addMonths,
  canTransition,
  defaultReviewCycleMonths,
  mayReference,
  nextVersion,
  searchableStatuses,
} from '../src/modules/policy/document-rules.js'
import { chunkDocument } from '../src/modules/policy/document-chunker.js'

/**
 * Modul C rules, tested as rules — no database, no Nest container.
 *
 * These are the assertions that would still matter if the whole persistence
 * layer were replaced: the normative hierarchy, the lifecycle's legal moves,
 * what an ordinary search may see, and the chunking that decides whether a
 * citation points at the right article.
 */

describe('FR-C-001 aturan 2 · hierarki normatif', () => {
  it('dokumen tingkat bawah boleh merujuk tingkat atas', () => {
    expect(mayReference('SOP', 'KEBIJAKAN')).toBe(true)
    expect(mayReference('INSTRUKSI_KERJA', 'PEDOMAN')).toBe(true)
  })

  it('dokumen tingkat atas TIDAK boleh merujuk tingkat bawah', () => {
    // The rule that matters: a Kebijakan citing an SOP makes the policy depend
    // on its own implementation detail.
    expect(mayReference('KEBIJAKAN', 'SOP')).toBe(false)
    expect(mayReference('PEDOMAN', 'INSTRUKSI_KERJA')).toBe(false)
  })

  it('sesama tingkat boleh saling merujuk', () => {
    expect(mayReference('SOP', 'SOP')).toBe(true)
  })

  it('instrumen di luar tangga hierarki tidak dibatasi', () => {
    expect(mayReference('SURAT_EDARAN', 'INSTRUKSI_KERJA')).toBe(true)
    expect(mayReference('KEBIJAKAN', 'LAMPIRAN_TEKNIS')).toBe(true)
  })
})

describe('FR-C-004 · mesin status siklus hidup', () => {
  it('mengikuti diagram: draf hanya bisa masuk penelaahan', () => {
    expect(canTransition('DRAF', 'DALAM_PENELAAHAN')).toBe(true)
    expect(canTransition('DRAF', 'BERLAKU')).toBe(false)
    expect(canTransition('DRAF', 'DISAHKAN')).toBe(false)
  })

  it('penelaah dan pengesah dapat mengembalikan ke draf', () => {
    expect(canTransition('DALAM_PENELAAHAN', 'DRAF')).toBe(true)
    expect(canTransition('MENUNGGU_PENGESAHAN', 'DRAF')).toBe(true)
  })

  it('Digantikan dan Ditarik bersifat terminal', () => {
    // History is not edited back into force; a new version is a new row.
    expect(canTransition('DIGANTIKAN', 'BERLAKU')).toBe(false)
    expect(canTransition('DITARIK', 'BERLAKU')).toBe(false)
    expect(canTransition('DITARIK', 'DALAM_REVISI')).toBe(false)
  })

  it('dokumen berlaku dapat direvisi, digantikan, atau ditarik', () => {
    expect(canTransition('BERLAKU', 'DALAM_REVISI')).toBe(true)
    expect(canTransition('BERLAKU', 'DIGANTIKAN')).toBe(true)
    expect(canTransition('BERLAKU', 'DITARIK')).toBe(true)
  })
})

describe('FR-C-004 aturan 1 & FR-C-010 aturan 3 · apa yang terlihat di pencarian', () => {
  it('pencarian umum hanya melihat dokumen berlaku', () => {
    expect(searchableStatuses(false)).toEqual(['BERLAKU'])
  })

  it('mode audit menambah Digantikan dan Ditarik', () => {
    expect(searchableStatuses(true)).toContain('DIGANTIKAN')
    expect(searchableStatuses(true)).toContain('DITARIK')
  })

  it('mode audit tidak pernah menampilkan draf', () => {
    // An unratified draft is not a rule that ever bound anyone; showing it to
    // an auditor as part of the corpus would misrepresent what was in force.
    expect(searchableStatuses(true)).not.toContain('DRAF')
    expect(searchableStatuses(true)).not.toContain('MENUNGGU_PENGESAHAN')
  })
})

describe('FR-C-006 aturan 1 · penomoran versi', () => {
  it('perubahan substansi menaikkan mayor dan mengenolkan minor', () => {
    expect(nextVersion({ major: 2, minor: 7 }, 'MAYOR')).toEqual({ major: 3, minor: 0 })
  })

  it('perbaikan redaksional menaikkan minor', () => {
    expect(nextVersion({ major: 2, minor: 9 }, 'MINOR')).toEqual({ major: 2, minor: 10 })
  })
})

describe('FR-C-008 aturan 1 · siklus tinjauan bawaan', () => {
  it('kebijakan 24 bulan, pedoman dan SOP 12 bulan', () => {
    expect(defaultReviewCycleMonths('KEBIJAKAN')).toBe(24)
    expect(defaultReviewCycleMonths('PEDOMAN')).toBe(12)
    expect(defaultReviewCycleMonths('SOP')).toBe(12)
    expect(defaultReviewCycleMonths('INSTRUKSI_KERJA')).toBe(12)
  })

  it('menghitung tanggal tinjauan berikutnya', () => {
    expect(addMonths(new Date('2026-01-31T00:00:00Z'), 12).getFullYear()).toBe(2027)
  })
})

describe('04-TRD Sec 4.1 · pemenggalan sadar struktur', () => {
  const doc = `BAB I KETENTUAN UMUM

Pasal 1

Dalam peraturan ini yang dimaksud dengan nasabah adalah pihak yang membuka rekening efek.

Pasal 2

Batas transaksi harian ditetapkan sebesar lima miliar rupiah.

BAB II PENGENDALIAN

Pasal 3

Setiap transaksi wajib memperoleh persetujuan kepala dealing.`

  it('memenggal pada batas pasal, bukan panjang tetap', () => {
    const chunks = chunkDocument('SOP Dealing', doc)
    const refs = chunks.map((c) => c.sectionRef)
    expect(refs.some((r) => r?.includes('Pasal 1'))).toBe(true)
    expect(refs.some((r) => r?.includes('Pasal 2'))).toBe(true)
    expect(refs.some((r) => r?.includes('Pasal 3'))).toBe(true)
  })

  it('rujukan bagian membawa bab yang benar', () => {
    const chunks = chunkDocument('SOP Dealing', doc)
    const pasal3 = chunks.find((c) => c.sectionRef?.includes('Pasal 3'))
    // Pasal 3 lives under Bab II, not Bab I: a citation that says otherwise
    // points the reader at the wrong chapter, which is the failure FR-C-013
    // exists to prevent.
    expect(pasal3?.sectionRef).toContain('Bab II')
    expect(pasal3?.sectionRef).not.toContain('Bab I ')
  })

  it('setiap penggalan diawali baris konteks berisi judul dokumen', () => {
    const chunks = chunkDocument('SOP Dealing', doc)
    for (const chunk of chunks) {
      expect(chunk.content.startsWith('SOP Dealing')).toBe(true)
    }
  })

  it('indeks penggalan berurutan mulai dari nol', () => {
    const chunks = chunkDocument('SOP Dealing', doc)
    expect(chunks.map((c) => c.index)).toEqual(chunks.map((_, i) => i))
  })

  it('dokumen tanpa struktur tetap dipenggal, bukan dibuang', () => {
    const chunks = chunkDocument('Memo', 'Sekadar catatan tanpa bab atau pasal.')
    expect(chunks.length).toBe(1)
    expect(chunks[0]?.sectionRef).toBeNull()
  })

  it('teks kosong menghasilkan nol penggalan', () => {
    expect(chunkDocument('Kosong', '   ')).toEqual([])
  })

  it('pasal yang sangat panjang dipecah pada batas paragraf', () => {
    const long = `Pasal 9\n\n${Array.from({ length: 6 }, (_, i) => `Ayat ${i} ` + 'kata '.repeat(300)).join('\n\n')}`
    const chunks = chunkDocument('SOP Panjang', long)
    expect(chunks.length).toBeGreaterThan(1)
    // Every piece keeps the same article reference, so a citation from any of
    // them still names Pasal 9.
    for (const chunk of chunks) expect(chunk.sectionRef).toContain('Pasal 9')
  })
})
