import { describe, expect, it } from 'vitest'
import {
  buildErrorFile,
  buildTemplate,
  FileFormatError,
  parseDelimited,
  validateRows,
} from '../src/modules/access/snapshot-csv.js'

/**
 * FR-B-004 aturan 1 s.d. 4 · TC-FN-B-010 s.d. TC-FN-B-014.
 *
 * The row rules decide whether an application owner's export becomes review
 * scope or becomes a list of red lines, so they are tested against the shapes
 * real exports actually arrive in -- semicolons, a byte order mark, CRLF,
 * quoted commas -- rather than only against a file this repository wrote.
 */
const context = { knownEntitlementCodes: new Set(['BO_REPORT_VIEW', 'BO_SETTLE_APPROVE']) }

const HEADER = 'account_id,account_name,entitlement_code,account_status'

describe('FR-B-004 aturan 2 · kolom wajib', () => {
  it('TC-FN-B-010 · menolak berkas tanpa kolom wajib', () => {
    expect(() => parseDelimited('account_id,account_name\nu-1,rudi')).toThrow(FileFormatError)
  })

  it('TC-FN-B-010 · menolak kolom yang tidak dikenali', () => {
    expect(() => parseDelimited(`${HEADER},kolom_asing\nu-1,rudi,BO_REPORT_VIEW,AKTIF,x`)).toThrow(
      /tidak dikenali/,
    )
  })

  it('TC-FN-B-010 · menolak berkas kosong', () => {
    expect(() => parseDelimited('   ')).toThrow(/kosong/)
  })

  it('setiap kolom wajib yang kosong dilaporkan tersendiri', () => {
    // Some content, so this is a row an author wrote rather than a blank line.
    const result = validateRows(`${HEADER},display_name\n,,,,Rudi Hartono`, context)
    expect(result.rows).toHaveLength(0)
    expect(result.issues.map((i) => i.column).sort()).toEqual([
      'account_id',
      'account_name',
      'account_status',
      'entitlement_code',
    ])
  })
})

describe('bentuk berkas yang ditemui di lapangan', () => {
  it('menerima pemisah titik koma — yang ditulis Excel pada lokal Indonesia', () => {
    const result = validateRows(
      'account_id;account_name;entitlement_code;account_status\nu-1;rudi;BO_REPORT_VIEW;AKTIF',
      context,
    )
    expect(result.issues).toHaveLength(0)
    expect(result.rows).toHaveLength(1)
  })

  it('menerima penanda urutan bita dan akhir baris CRLF', () => {
    const bom = '\uFEFF'
    const result = validateRows(`${bom}${HEADER}\r\nu-1,rudi,BO_REPORT_VIEW,AKTIF\r\n`, context)
    expect(result.issues).toHaveLength(0)
    expect(result.rows[0]?.accountId).toBe('u-1')
  })

  it('menerima koma di dalam nilai berkutip', () => {
    const result = validateRows(`${HEADER}\n"u,1",rudi,BO_REPORT_VIEW,AKTIF`, context)
    expect(result.rows[0]?.accountId).toBe('u,1')
  })

  it('melewati baris penjelasan templat tanpa melaporkannya sebagai kesalahan', () => {
    const template = buildTemplate(['BO_REPORT_VIEW'])
    const result = validateRows(template, context)
    expect(result.issues).toHaveLength(0)
    // Only the example row counts; the description line is neither a row nor an error.
    expect(result.totalRows).toBe(1)
  })
})

describe('FR-B-004 aturan 3 · validasi per baris', () => {
  it('TC-FN-B-011 · menolak kode hak akses di luar katalog aplikasi', () => {
    const result = validateRows(`${HEADER}\nu-1,rudi,BO_XYZ,AKTIF`, context)
    expect(result.issues[0]).toMatchObject({ row: 2, code: 'UNKNOWN_ENTITLEMENT', column: 'entitlement_code' })
    expect(result.rows).toHaveLength(0)
  })

  it('TC-FN-B-012 · menolak status akun di luar AKTIF/NONAKTIF', () => {
    const result = validateRows(`${HEADER}\nu-1,rudi,BO_REPORT_VIEW,active`, context)
    expect(result.issues[0]).toMatchObject({ code: 'INVALID_ENUM', value: 'active' })
  })

  it('menolak tanggal yang tidak ada di kalender', () => {
    const rows = `${HEADER},granted_at\nu-1,rudi,BO_REPORT_VIEW,AKTIF,2026-02-31`
    const result = validateRows(rows, context)
    // 2026-02-31 would otherwise roll forward into March and be stored as a
    // date the file never contained.
    expect(result.issues[0]).toMatchObject({ code: 'INVALID_DATE', column: 'granted_at' })
  })

  it('menolak pasangan akun dan hak akses yang sama dua kali', () => {
    const rows = `${HEADER}\nu-1,rudi,BO_REPORT_VIEW,AKTIF\nu-1,rudi,BO_REPORT_VIEW,AKTIF`
    const result = validateRows(rows, context)
    expect(result.issues[0]).toMatchObject({ row: 3, code: 'DUPLICATE_ROW' })
    expect(result.issues[0]?.message).toContain('baris 2')
    expect(result.rows).toHaveLength(1)
  })

  it('memeriksa seluruh baris, bukan berhenti pada kesalahan pertama', () => {
    const rows = [HEADER, 'u-1,rudi,BO_XYZ,AKTIF', 'u-2,budi,BO_ABC,AKTIF', 'u-3,eko,BO_DEF,AKTIF'].join('\n')
    const result = validateRows(rows, context)
    expect(result.issues).toHaveLength(3)
  })

  it('TC-FN-B-013 · baris sah tetap dipertahankan ketika baris lain bermasalah', () => {
    const rows = [HEADER, 'u-1,rudi,BO_REPORT_VIEW,AKTIF', 'u-2,budi,BO_XYZ,AKTIF'].join('\n')
    const result = validateRows(rows, context)
    expect(result.totalRows).toBe(2)
    expect(result.rows).toHaveLength(1)
    expect(result.issues).toHaveLength(1)
  })

  it('menormalkan kode hak akses ke huruf besar sebelum dicocokkan', () => {
    const result = validateRows(`${HEADER}\nu-1,rudi,bo_report_view,aktif`, context)
    expect(result.issues).toHaveLength(0)
    expect(result.rows[0]?.entitlementCode).toBe('BO_REPORT_VIEW')
  })
})

describe('FR-B-004 aturan 1 dan 4 · templat dan berkas kesalahan', () => {
  it('templat memakai kode hak akses nyata dari katalog aplikasi', () => {
    const template = buildTemplate(['BO_SETTLE_APPROVE'])
    expect(template).toContain('BO_SETTLE_APPROVE')
  })

  it('templat tetap sah bila aplikasi belum punya katalog', () => {
    const result = validateRows(buildTemplate([]), {
      knownEntitlementCodes: new Set(['KODE_HAK_AKSES']),
    })
    expect(result.issues).toHaveLength(0)
  })

  it('berkas kesalahan memuat nomor baris dan keterangan tiap masalah', () => {
    const result = validateRows(`${HEADER}\nu-1,rudi,BO_XYZ,AKTIF`, context)
    const file = buildErrorFile(result.issues)
    expect(file.split('\n')[0]).toBe('baris,kolom,nilai,kode,keterangan')
    expect(file).toContain('UNKNOWN_ENTITLEMENT')
    expect(file).toContain('BO_XYZ')
  })

  it('berkas kesalahan mengutip keterangan yang memuat koma atau kutip', () => {
    const file = buildErrorFile([
      { row: 2, column: 'entitlement_code', code: 'X', message: 'Satu, dua "tiga"', value: null },
    ])
    expect(file).toContain('"Satu, dua ""tiga"""')
  })
})

describe('baris kosong', () => {
  it('mengabaikan baris kosong dan tidak menghitungnya sebagai baris berkas', () => {
    // A trailing blank line is how nearly every editor ends a file. Reporting
    // it as four missing required columns would make a clean export look broken.
    const result = validateRows(`${HEADER}\nu-1,rudi,BO_REPORT_VIEW,AKTIF\n\n`, context)
    expect(result.issues).toHaveLength(0)
    expect(result.totalRows).toBe(1)
  })
})
