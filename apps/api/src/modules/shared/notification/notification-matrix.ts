/**
 * FR-X-011 · the notification matrix, as data.
 *
 * One row per NT code, transcribed from the table in 03-FRD §2.4. It is a
 * literal table rather than scattered `sendNotification(...)` calls with inline
 * flags because the property that matters is a property of the WHOLE set: a
 * reader (or a Compliance Officer) has to be able to check that every
 * escalation is un-suppressable without reading twenty call sites. A flag typed
 * at each call site is a flag that will eventually be typed wrong at one of
 * them, and the one that is wrong will be the one nobody notices.
 *
 * `canBeSummarized: false` is the load-bearing field. FR-X-010 rule 2 states
 * that escalation and missed-deadline notifications cannot be summarised or
 * switched off. That is not a preference: these are the messages that exist
 * precisely because someone has already stopped paying attention, so allowing
 * the inattentive person to mute them removes the control at exactly the moment
 * it is doing its job. The engine therefore does not consult user preferences
 * for these codes at all -- see `notification.service.ts`.
 */

export type NotificationChannel = 'APLIKASI' | 'SUREL' | 'SUREL_DAN_APLIKASI'

export interface NotificationSpec {
  readonly code: string
  /** What causes it, in the FRD's words. Kept for traceability, not display. */
  readonly trigger: string
  readonly channel: NotificationChannel
  /** FR-X-010 rule 2. False means preferences are not consulted. */
  readonly canBeSummarized: boolean
}

export const NOTIFICATION_MATRIX: readonly NotificationSpec[] = [
  { code: 'NT-01', trigger: 'Permintaan bukti diterbitkan', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-02', trigger: 'Tenggat permintaan bukti H-3', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-03', trigger: 'Tenggat permintaan bukti terlewat', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-04', trigger: 'Bukti ditolak auditor', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-05', trigger: 'Bukti diterima', channel: 'APLIKASI', canBeSummarized: true },
  { code: 'NT-06', trigger: 'Temuan ditugaskan', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-07', trigger: 'Tenggat tindak lanjut terlewat', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-08', trigger: 'Kampanye review dimulai', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-09', trigger: 'Kemajuan review di bawah ambang pada titik tengah', channel: 'SUREL', canBeSummarized: true },
  { code: 'NT-10', trigger: 'Tenggat kampanye H-2', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-11', trigger: 'Kampanye terlewat tenggat', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-12', trigger: 'Tiket pencabutan dibuat', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-13', trigger: 'Tiket pencabutan melewati SLA', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-14', trigger: 'Verifikasi pencabutan gagal', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-15', trigger: 'Konektor gagal berjalan', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-16', trigger: 'Akun terminated-but-active terdeteksi', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-17', trigger: 'Pelanggaran SoD baru terdeteksi', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-18', trigger: 'Dokumen menunggu penelaahan', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-19', trigger: 'Dokumen menunggu pengesahan', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  {
    code: 'NT-20',
    trigger: 'Tinjauan berkala dokumen H-60/-30/-14/-7',
    channel: 'SUREL_DAN_APLIKASI',
    // "Ya kecuali H-7" in the FRD. The exception is a property of the occasion,
    // not of the code, so the H-7 caller passes an explicit override rather
    // than this row claiming to know which of the four dates it is.
    canBeSummarized: true,
  },
  { code: 'NT-21', trigger: 'Dokumen terlambat ditinjau', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-22', trigger: 'Dokumen baru berlaku pada unit terkait', channel: 'APLIKASI', canBeSummarized: true },
  { code: 'NT-23', trigger: 'Tugas attestation diterbitkan', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-24', trigger: 'Attestation terlewat tenggat', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: false },
  { code: 'NT-25', trigger: 'Akses AUDITOR_EXT akan berakhir H-7', channel: 'APLIKASI', canBeSummarized: true },
  { code: 'NT-26', trigger: 'Permintaan pengecualian diajukan', channel: 'SUREL_DAN_APLIKASI', canBeSummarized: true },
  { code: 'NT-27', trigger: 'Penggunaan akun darurat', channel: 'SUREL', canBeSummarized: false },
  { code: 'NT-28', trigger: 'Gerbang LLM menolak permintaan karena klasifikasi', channel: 'SUREL', canBeSummarized: true },
] as const

const BY_CODE = new Map(NOTIFICATION_MATRIX.map((s) => [s.code, s]))

/**
 * Look up a code, refusing unknown ones.
 *
 * Throwing rather than defaulting is deliberate. A typo'd code that silently
 * fell back to "summarizable, in-app only" would downgrade an escalation into
 * the quietest possible delivery -- the exact opposite of what a mistyped
 * escalation should do.
 */
export function specFor(code: string): NotificationSpec {
  const spec = BY_CODE.get(code)
  if (!spec) throw new Error(`Kode notifikasi tidak dikenal: ${code}`)
  return spec
}

export function sendsEmail(spec: NotificationSpec): boolean {
  return spec.channel === 'SUREL' || spec.channel === 'SUREL_DAN_APLIKASI'
}

export function sendsInApp(spec: NotificationSpec): boolean {
  return spec.channel === 'APLIKASI' || spec.channel === 'SUREL_DAN_APLIKASI'
}
