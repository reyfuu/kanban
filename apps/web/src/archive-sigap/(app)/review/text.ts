/**
 * Interface text for the reviewer screen (06-DESIGN §9.2 rule 6).
 *
 * Kept out of the components so Divisi Kepatuhan can review the wording without
 * reading TSX. That is not a courtesy: several of these strings ARE the control.
 * The reason label that says *why* a reason is required, and the warning that
 * sign-off cannot be undone, are what make L-10 rules 4 and L-11 rule 3 true for
 * the person at the screen. Changing them changes the control.
 *
 * Standard terms come from 06-DESIGN §7.2 — do not invent synonyms.
 */
export const REVIEW_TEXT = {
  title: 'Review Saya',
  intro:
    'Setiap baris adalah satu hak akses yang dipegang seseorang. Pilih keputusan untuk masing-masing. Tidak ada pilihan yang terisi otomatis.',

  filters: {
    all: 'Semua',
    pending: 'Belum diputuskan',
    attention: 'Perlu perhatian',
    done: 'Selesai',
  },

  progress: (decided: number, total: number) => `${decided} dari ${total} selesai`,
  dueIn: (days: number) =>
    days < 0
      ? `Terlewat ${Math.abs(days)} hari`
      : days === 0
        ? 'Jatuh tempo hari ini'
        : `${days} hari lagi`,

  decision: {
    legend: 'Keputusan Anda',
    PERTAHANKAN: 'Pertahankan',
    CABUT: 'Cabut',
    UBAH: 'Ubah',
    ALIHKAN: 'Alihkan',
  },

  decisionMeaning: {
    PERTAHANKAN: 'Akses masih diperlukan',
    CABUT: 'Akses tidak lagi diperlukan',
    UBAH: 'Akses perlu diturunkan atau disesuaikan',
    ALIHKAN: 'Bukan wewenang saya',
  },

  reason: {
    label: 'Alasan',
    optional: 'opsional',
    placeholder: 'Jelaskan pertimbangan Anda dalam satu atau dua kalimat.',
    hint: 'Minimal 10 karakter. Alasan menjadi bagian dari bukti audit dan dibaca oleh pemeriksa.',
  },

  badge: {
    privileged: 'ISTIMEWA',
    critical: 'KRITIS',
    high: 'RISIKO TINGGI',
    sodConflict: 'KONFLIK PEMISAHAN TUGAS',
    anomaly: 'ANOMALI',
    signed: 'Ditandatangani',
  },

  context: {
    grantedAt: 'Diberikan',
    grantedBy: 'oleh',
    lastAccess: 'Terakhir diakses',
    neverAccessed: 'Belum pernah diakses',
    account: 'Akun',
  },

  actions: {
    save: 'Simpan',
    saving: 'Menyimpan…',
    bulkSelectAll: 'Pilih semua yang terlihat',
    bulkApply: (n: number) => `Putuskan ${n} item terpilih`,
    bulkHeading: 'Item rutin — dapat diputuskan massal',
    bulkNote:
      'Item berisiko tinggi, istimewa, berkonflik, atau beranomali tidak muncul di sini. Item tersebut harus diputuskan satu per satu.',
  },

  states: {
    loading: 'Memuat item review…',
    empty: 'Tidak ada item review untuk Anda saat ini.',
    emptyFiltered: 'Tidak ada item yang cocok dengan penyaring ini.',
    error: 'Daftar item review tidak dapat dimuat.',
    allDone: 'Seluruh item dalam cakupan Anda telah diputuskan.',
  },

  signoff: {
    heading: 'Tanda Tangan Hasil Review',
    open: 'Tanda tangani hasil review',
    summaryHeading: 'Ringkasan keputusan Anda',
    total: 'Total',
    consequence: (n: number) =>
      `${n} keputusan "Cabut" atau "Ubah" akan menghasilkan tiket pencabutan yang dipantau sampai terverifikasi.`,
    statement:
      'Saya menyatakan telah meninjau seluruh hak akses dalam cakupan tanggung jawab saya dan keputusan yang diambil telah sesuai dengan kebutuhan bisnis saat ini.',
    passwordLabel: 'Masukkan kata sandi untuk menandatangani',
    passwordHint: 'Autentikasi ulang diperlukan untuk aksi ini (FR-X-003).',
    warning:
      'Setelah ditandatangani, keputusan tidak dapat diubah tanpa persetujuan IT Security Officer.',
    cancel: 'Batal',
    submit: 'Tanda Tangani',
    submitting: 'Menandatangani…',
    signedNotice: (at: string) => `Ditandatangani pada ${at}. Keputusan bersifat final.`,
  },
} as const
