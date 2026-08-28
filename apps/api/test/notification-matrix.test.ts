import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  NOTIFICATION_MATRIX,
  sendsEmail,
  sendsInApp,
  specFor,
} from '../src/modules/shared/notification/notification-matrix.js'

/**
 * FR-X-011 · the matrix in code must equal the matrix in the FRD.
 *
 * This test parses 03-FRD.md and compares it row by row, rather than restating
 * the 28 rows a third time. Restating them would only prove that two copies I
 * typed agree with each other; parsing the document proves the code agrees with
 * the source of truth, which is the property CLAUDE.md actually asks for
 * ("dokumen adalah sumber kebenaran").
 *
 * It also makes the failure useful: change the FRD table and this fails naming
 * the exact code that drifted, instead of the mismatch surviving until someone
 * wonders why an escalation was summarised away.
 */

const FRD = fileURLToPath(new URL('../../../docs/03-FRD.md', import.meta.url))

interface DocRow {
  code: string
  channel: string
  summarizable: string
}

function parseDoc(): DocRow[] {
  const rows: DocRow[] = []
  for (const line of readFileSync(FRD, 'utf8').split('\n')) {
    if (!line.startsWith('| NT-')) continue
    const cells = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
    const [code, , , channel, summarizable] = cells
    if (code && channel && summarizable) rows.push({ code, channel, summarizable })
  }
  return rows
}

const doc = parseDoc()

describe('FR-X-011 · matriks notifikasi setara dengan 03-FRD', () => {
  it('dokumennya benar-benar terbaca (penjaga terhadap tes yang lolos karena kosong)', () => {
    // Tanpa ini, sebuah perubahan format tabel akan membuat parser mengembalikan
    // nol baris dan SELURUH tes di bawah lulus tanpa memeriksa apa pun.
    expect(doc.length).toBe(28)
  })

  it('setiap kode di dokumen ada di kode, dan sebaliknya', () => {
    expect(NOTIFICATION_MATRIX.map((s) => s.code).sort()).toEqual(doc.map((r) => r.code).sort())
  })

  it('kanal tiap kode sama dengan dokumen', () => {
    for (const row of doc) {
      const spec = specFor(row.code)
      const expectedEmail = row.channel.includes('Surel')
      const expectedInApp = row.channel.includes('aplikasi') || row.channel.includes('Aplikasi')
      expect(sendsEmail(spec), `${row.code} kanal surel`).toBe(expectedEmail)
      expect(sendsInApp(spec), `${row.code} kanal aplikasi`).toBe(expectedInApp)
    }
  })

  it('KODE YANG TIDAK DAPAT DIRINGKAS sama persis dengan dokumen', () => {
    // Aturan terpenting FR-X-010 nomor 2. Satu baris yang salah di sini berarti
    // sebuah eskalasi dapat dibungkam oleh orang yang justru sedang dieskalasi.
    const docNo = doc
      .filter((r) => r.summarizable.includes('Tidak') && !r.summarizable.startsWith('Ya'))
      .map((r) => r.code)
      .sort()
    const codeNo = NOTIFICATION_MATRIX.filter((s) => !s.canBeSummarized)
      .map((s) => s.code)
      .sort()

    expect(codeNo).toEqual(docNo)
    expect(codeNo.length).toBe(11)
  })
})

describe('FR-X-011 · pencarian kode', () => {
  it('kode tak dikenal melempar, bukan mengembalikan bawaan', () => {
    // Bawaan diam-diam akan menurunkan eskalasi yang salah ketik menjadi
    // pengiriman paling senyap — kebalikan dari yang seharusnya terjadi.
    expect(() => specFor('NT-99')).toThrow(/tidak dikenal/)
  })
})
