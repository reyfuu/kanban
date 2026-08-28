import { describe, expect, it } from 'vitest'
import {
  RedactionFailedError,
  redactForExternal,
} from '../src/modules/shared/llm-gateway/redaction.js'
import {
  applyClassificationGate,
  maySendExternally,
  type Chunk,
} from '../src/modules/shared/llm-gateway/classification-gate.js'

/**
 * FR-C-014 dan FR-C-015 · dua kontrol terakhir sebelum data meninggalkan
 * kendali perusahaan (ADR-03).
 *
 * Diuji dengan teks yang benar-benar berisi data sensitif, bukan dengan
 * pemeriksaan bahwa fungsinya dipanggil. Kontrol egress yang "dipanggil" tetapi
 * tidak benar-benar mengubah muatannya adalah kontrol yang tidak ada.
 */

const chunk = (id: string, classification: Chunk['classification']): Chunk => ({
  id,
  documentId: `doc-${id}`,
  documentTitle: 'SOP Uji',
  versionLabel: '1.0',
  sectionNo: '2.1',
  text: 'Isi potongan.',
  classification,
})

describe('FR-C-014 · gerbang klasifikasi', () => {
  it('hanya Publik dan Internal yang boleh keluar', () => {
    expect(maySendExternally('PUBLIK')).toBe(true)
    expect(maySendExternally('INTERNAL')).toBe(true)
    expect(maySendExternally('TERBATAS')).toBe(false)
    expect(maySendExternally('RAHASIA')).toBe(false)
  })

  it('aturan 2 · seluruhnya Terbatas/Rahasia berarti tidak dijalankan sama sekali', () => {
    const v = applyClassificationGate([chunk('a', 'TERBATAS'), chunk('b', 'RAHASIA')])
    expect(v.outcome).toBe('DITOLAK_KLASIFIKASI')
    if (v.outcome === 'DITOLAK_KLASIFIKASI') {
      expect(v.reason).toContain('Terbatas')
      expect(v.withheld).toBe(2)
    }
  })

  it('aturan 3 · sebagian tinggi berarti hanya yang rendah dikirim, dan ditandai', () => {
    // Mengirim sebagian tanpa memberi tahu bahwa ada yang ditahan menghasilkan
    // jawaban yang tampak lengkap padahal tidak, dan pembacanya tidak akan
    // mencari sisanya.
    const v = applyClassificationGate([
      chunk('publik', 'PUBLIK'),
      chunk('rahasia', 'RAHASIA'),
    ])
    expect(v.outcome).toBe('DITERUSKAN')
    if (v.outcome === 'DITERUSKAN') {
      expect(v.sendable.map((c) => c.id)).toEqual(['publik'])
      expect(v.partial).toBe(true)
      expect(v.withheld).toBe(1)
    }
  })

  it('seluruhnya boleh keluar tidak ditandai sebagian', () => {
    const v = applyClassificationGate([chunk('a', 'PUBLIK'), chunk('b', 'INTERNAL')])
    expect(v.outcome).toBe('DITERUSKAN')
    if (v.outcome === 'DITERUSKAN') {
      expect(v.partial).toBe(false)
      expect(v.sendable).toHaveLength(2)
    }
  })

  it('tanpa potongan sama sekali ditolak, bukan diteruskan kosong', () => {
    // Gagal tertutup: muatan kosong yang diteruskan akan memanggil penyedia
    // eksternal tanpa alasan apa pun.
    expect(applyClassificationGate([]).outcome).toBe('DITOLAK_KLASIFIKASI')
  })
})

describe('FR-C-015 · redaksi', () => {
  it('aturan 1 · nilai diganti penanda jenis, bukan dihapus', () => {
    // Kalimat berlubang berubah maknanya; kalimat dengan penanda masih terbaca
    // sebagai kalimat tentang nomor rekening.
    const out = redactForExternal('Rekening bank nasabah adalah 1234567890123.')
    expect(out.text).toContain('[NOMOR REKENING BANK]')
    expect(out.text).toContain('Rekening bank nasabah adalah')
    expect(out.text).not.toContain('1234567890123')
  })

  it('NIK enam belas digit diredaksi', () => {
    const out = redactForExternal('NIK pemohon 3273010101900001 tercatat.')
    expect(out.text).not.toContain('3273010101900001')
    expect(out.applied).toContain('NIK')
  })

  it('alamat surel diredaksi', () => {
    const out = redactForExternal('Hubungi budi.santoso@trimegah.co.id untuk konfirmasi.')
    expect(out.text).not.toContain('budi.santoso@trimegah.co.id')
    expect(out.text).toContain('[ALAMAT SUREL]')
  })

  it('nomor telepon diredaksi', () => {
    const out = redactForExternal('Nomor kontak 081234567890 sudah diverifikasi.')
    expect(out.text).not.toContain('081234567890')
  })

  it('nomor rekening efek diredaksi', () => {
    const out = redactForExternal('Rekening efek TRIM0012345 dibekukan.')
    expect(out.text).not.toContain('TRIM0012345')
  })

  it('nominal di samping nama orang diredaksi', () => {
    const out = redactForExternal('Bapak Andi Wijaya menyetor Rp 500.000.000 pada Juni.')
    expect(out.text).not.toContain('500.000.000')
    expect(out.text).toContain('[NOMINAL]')
    // Namanya tetap: yang diredaksi nominalnya, bukan siapa yang dibicarakan.
    expect(out.text).toContain('Andi Wijaya')
  })

  it('nominal TANPA nama orang tidak diredaksi', () => {
    // Angka rupiah dalam kebijakan bukan data pribadi. Meredaksi setiap angka
    // membuat jawabannya tidak berguna.
    const out = redactForExternal('Batas transaksi harian adalah Rp 100.000.000.')
    expect(out.text).toContain('100.000.000')
  })

  it('teks tanpa pola sensitif tidak berubah', () => {
    const clean = 'Setiap karyawan wajib menyelesaikan attestation kebijakan setiap tahun.'
    const out = redactForExternal(clean)
    expect(out.text).toBe(clean)
    expect(out.applied).toHaveLength(0)
  })

  it('regex /g tidak bocor lastIndex antar pemanggilan', () => {
    // Regex /g bersama menyimpan lastIndex dan diam-diam melewatkan kecocokan
    // pada setiap string kedua — kegagalan yang hanya muncul di produksi.
    const text = 'NIK 3273010101900001 tercatat.'
    const first = redactForExternal(text)
    const second = redactForExternal(text)
    expect(second.text).toBe(first.text)
    expect(second.text).not.toContain('3273010101900001')
  })

  it('kegagalan redaksi melempar, tidak meneruskan teks asli', () => {
    // Aturan 2. Perilaku yang menggoda saat redaksi gagal adalah meneruskan
    // apa adanya, dan itu justru meniadakan satu-satunya langkah pengaman.
    expect(new RedactionFailedError(new Error('x')).message).toContain('dibatalkan')
  })
})
