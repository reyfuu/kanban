import { describe, expect, it } from 'vitest'
import {
  ESCALATION_LADDER,
  daysFromDue,
  isCritical,
  stageFor,
} from '../src/modules/evidence/escalation-rules.js'

/**
 * FR-A-008 · pengingat & eskalasi otomatis.
 *
 * Diuji terhadap tabel di FRD, bukan terhadap implementasinya. Dua sifat yang
 * paling menentukan apakah kontrol ini bekerja: setiap tahap berbunyi tepat
 * sekali pada harinya, dan audiensnya hanya bertambah, tidak pernah berganti.
 */

const due = new Date('2026-06-10T00:00:00.000Z')
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

describe('FR-A-008 · tangga eskalasi', () => {
  it('lima tahap sesuai tabel FRD', () => {
    expect(ESCALATION_LADDER.map((s) => s.offsetDays)).toEqual([-3, -1, 0, 3, 7])
  })

  it('H-3 dan H-1 hanya ke PIC', () => {
    expect(stageFor(due, day('2026-06-07'))?.audience).toBe('PIC')
    expect(stageFor(due, day('2026-06-09'))?.audience).toBe('PIC')
  })

  it('tenggat terlewat menarik atasan langsung', () => {
    expect(stageFor(due, day('2026-06-10'))?.audience).toBe('PIC_DAN_ATASAN')
  })

  it('3 hari menarik ketua tim audit', () => {
    expect(stageFor(due, day('2026-06-13'))?.audience).toBe('PIC_ATASAN_DAN_KETUA_TIM')
  })

  it('7 hari ditandai kritis', () => {
    expect(stageFor(due, day('2026-06-17'))?.audience).toBe('KRITIS')
  })

  it('audiens hanya bertambah, tidak pernah berganti', () => {
    // Kalau eskalasi mengganti penerima alih-alih menambah, PIC berhenti
    // diberi tahu tentang keterlambatannya sendiri justru saat keterlambatan
    // itu menjadi masalah — dan orang yang paling bisa memperbaikinya menjadi
    // satu-satunya yang tidak mendengar apa-apa.
    const order = ['PIC', 'PIC_DAN_ATASAN', 'PIC_ATASAN_DAN_KETUA_TIM', 'KRITIS']
    const seen = ESCALATION_LADDER.map((s) => order.indexOf(s.audience))
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i]!).toBeGreaterThanOrEqual(seen[i - 1]!)
    }
  })

  it('tahap berbunyi TEPAT SEKALI, bukan setiap hari sesudahnya', () => {
    // Uji ambang ("sudah lewat 3 hari atau lebih") akan mengulang eskalasi yang
    // sama tiap pagi, dan PIC yang menerima peringatan identik setiap hari
    // belajar menyaring peringatan.
    expect(stageFor(due, day('2026-06-14'))).toBeNull()
    expect(stageFor(due, day('2026-06-15'))).toBeNull()
    expect(stageFor(due, day('2026-06-20'))).toBeNull()
  })

  it('hari tanpa tahap tidak mengirim apa pun', () => {
    expect(stageFor(due, day('2026-06-08'))).toBeNull()
    expect(stageFor(due, day('2026-06-01'))).toBeNull()
  })

  it('tahap setelah tenggat memakai NT-03 yang tidak dapat diringkas', () => {
    // Seluruh tahap sejak hari-H adalah pesan tentang sesuatu yang sudah
    // terlambat, jadi tidak boleh bisa dibungkam oleh penerimanya.
    for (const stage of ESCALATION_LADDER.filter((s) => s.offsetDays >= 0)) {
      expect(stage.notificationCode).toBe('NT-03')
    }
  })
})

describe('FR-A-008 · penghitungan hari', () => {
  it('menghitung hari kalender, bukan selisih milidetik', () => {
    // Permintaan yang jatuh tempo "hari ini" harus nol hari terlambat bagi
    // siapa pun, terlepas dari jam berapa pekerjaan terjadwal berjalan.
    expect(daysFromDue(due, new Date('2026-06-10T23:59:00.000Z'))).toBe(0)
    expect(daysFromDue(due, new Date('2026-06-10T00:00:01.000Z'))).toBe(0)
  })

  it('kritis sejak hari ketujuh dan seterusnya', () => {
    expect(isCritical(due, day('2026-06-16'))).toBe(false)
    expect(isCritical(due, day('2026-06-17'))).toBe(true)
    expect(isCritical(due, day('2026-07-30'))).toBe(true)
  })
})
