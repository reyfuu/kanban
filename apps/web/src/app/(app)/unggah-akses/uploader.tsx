'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { formatDaysAgo, formatNumber } from '@/lib/format'
import type { ApplicationRow } from '../aplikasi/page'
import {
  commitUpload,
  fetchErrorFile,
  fetchTemplate,
  validateUpload,
  type ValidationPreview,
} from './actions'

/**
 * Screen L-14 · Unggah Data Akses (FR-B-004) — three steps on one page.
 *
 * Step 1 downloads the template, step 2 uploads and validates, step 3 previews
 * what the file will do and lets the author commit. The preview is the whole
 * point: FR-B-004 aturan 3 and 6 require the author to see valid-row count,
 * problem-row count, ownerless-account count and any 30%+ row drop BEFORE
 * anything is written. The commit runs the same code the preview reported on,
 * so the numbers shown are the numbers that land.
 *
 * The final choice has no default (L-14 aturan 3, U4): "cancel and fix" and
 * "continue with valid rows only" are both explicit, because a default here
 * would be accepted as readily as a default decision would.
 */
export function AccessUploader({ applications }: { applications: ApplicationRow[] }) {
  const router = useRouter()
  const fileInput = useRef<HTMLInputElement>(null)

  const [applicationId, setApplicationId] = useState('')
  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ValidationPreview | null>(null)

  // The last-step decision (aturan 3): null until the author chooses.
  const [proceed, setProceed] = useState<'cancel' | 'valid-only' | null>(null)
  // FR-B-004 aturan 6: each requires_confirmation warning must be ticked, and a
  // note is mandatory when any is present.
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set())
  const [note, setNote] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<{ lineCount: number; closed: number; failed: number } | null>(null)

  const selectedApp = applications.find((a) => a.id === applicationId) ?? null
  const confirmable = preview?.warnings.filter((w) => w.requires_confirmation) ?? []
  const hasInvalid = (preview?.invalid_rows ?? 0) > 0

  async function downloadTemplate() {
    if (!applicationId) return
    setError(null)
    const result = await fetchTemplate(applicationId)
    if (!result.ok) {
      setError(result.message)
      return
    }
    triggerDownload(result.fileName, result.body)
  }

  async function downloadErrorFile() {
    if (!preview) return
    const result = await fetchErrorFile(preview.validation_id)
    if (!result.ok) {
      setError(result.message)
      return
    }
    triggerDownload(result.fileName, result.body)
  }

  async function onValidate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setBusy(true)
    setError(null)
    setPreview(null)
    setProceed(null)
    setConfirmed(new Set())
    setNote('')

    const result = await validateUpload(form)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setPreview(result.preview)
  }

  async function onCommit() {
    if (!preview) return
    setBusy(true)
    setError(null)

    const result = await commitUpload({
      validationId: preview.validation_id,
      skipInvalidRows: hasInvalid,
      confirmWarnings: [...confirmed],
      ...(note.trim() ? { confirmationNote: note.trim() } : {}),
    })
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setDone({ lineCount: result.lineCount, closed: result.verification.closed, failed: result.verification.failed })
    setPreview(null)
    router.refresh()
  }

  // The commit is allowed only once every gate the server enforces is satisfied
  // on the client too, so the button does not offer an action that will bounce:
  // a decision made, every confirmation ticked, and a note when one is required.
  const needsNote = confirmable.length > 0
  const allConfirmed = confirmable.every((w) => confirmed.has(w.code))
  const canCommit =
    proceed === 'valid-only' && allConfirmed && (!needsNote || note.trim().length > 0)

  if (done) {
    return (
      <div>
        <h1 className="text-xl font-semibold text-sg-neutral-900">Unggah Data Akses</h1>
        <div className="mt-6 rounded-lg border border-sg-success-500 bg-sg-success-50 p-5">
          <p className="text-sm font-medium text-sg-success-700">
            Snapshot tersimpan · {formatNumber(done.lineCount)} baris.
          </p>
          <p className="mt-2 text-sm text-sg-neutral-700">
            {/* K-1 made visible: the upload is the fresh evidence that closes
                pending revocation tickets. */}
            Verifikasi pencabutan: {formatNumber(done.closed)} tiket tertutup
            {done.failed > 0 ? `, ${formatNumber(done.failed)} gagal diverifikasi` : ''}.
          </p>
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setDone(null)
                setFileName(null)
                if (fileInput.current) fileInput.current.value = ''
              }}
              className="rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm font-medium text-sg-neutral-800 hover:bg-sg-neutral-50"
            >
              Unggah lagi
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-sg-neutral-900">Unggah Data Akses</h1>
      <p className="mt-1 max-w-3xl text-sm text-sg-neutral-600">
        Unggahan menghasilkan snapshot bertanggal dengan penanda sumber manual dan identitas Anda
        (FR-B-004). Validasi berjalan tanpa menyimpan apa pun; snapshot baru tersimpan hanya setelah
        Anda mengonfirmasi pratinjaunya.
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
          {error}
        </p>
      )}

      {/* Langkah 1 — aplikasi & templat */}
      <section className="mt-5 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-5">
        <h2 className="text-sm font-medium text-sg-neutral-900">1. Pilih aplikasi dan unduh templat</h2>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="aplikasi" className="block text-xs font-medium text-sg-neutral-700">
              Aplikasi tujuan
            </label>
            <select
              id="aplikasi"
              value={applicationId}
              onChange={(e) => {
                setApplicationId(e.target.value)
                setPreview(null)
                setError(null)
              }}
              className="mt-1 w-72 rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
            >
              <option value="">— pilih —</option>
              {applications.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={downloadTemplate}
            disabled={!applicationId}
            className="rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm font-medium text-sg-neutral-800 hover:bg-sg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Unduh templat CSV
          </button>
        </div>
        {selectedApp && (
          <p className="mt-2 text-xs text-sg-neutral-600">
            Snapshot terakhir:{' '}
            {selectedApp.latest_snapshot
              ? formatDaysAgo(selectedApp.latest_snapshot.age_days)
              : 'belum ada'}
            . Templat memuat kolom wajib, penjelasan tiap kolom, dan contoh baris.
          </p>
        )}
      </section>

      {/* Langkah 2 — unggah & validasi */}
      <section className="mt-4 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-5">
        <h2 className="text-sm font-medium text-sg-neutral-900">2. Unggah berkas terisi</h2>
        <form onSubmit={onValidate} className="mt-3">
          <input type="hidden" name="application_id" value={applicationId} />
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInput}
              type="file"
              name="file"
              accept=".csv,text/csv"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
              className="block text-sm text-sg-neutral-700 file:mr-3 file:rounded-md file:border file:border-sg-neutral-300 file:bg-sg-neutral-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-sg-neutral-800 hover:file:bg-sg-neutral-100"
            />
            <button
              type="submit"
              disabled={busy || !applicationId || !fileName}
              className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Memvalidasi…' : 'Validasi'}
            </button>
          </div>
          <p className="mt-2 text-xs text-sg-neutral-500">
            Hanya CSV (UTF-8). Berkas XLSX belum didukung — simpan sebagai CSV lebih dulu.
          </p>
        </form>
      </section>

      {/* Langkah 3 — pratinjau hasil validasi */}
      {preview && (
        <section className="mt-4 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-5">
          <h2 className="text-sm font-medium text-sg-neutral-900">3. Hasil validasi</h2>

          <p className="mt-2 text-base font-semibold text-sg-neutral-900 tabular-nums">
            {formatNumber(preview.total_rows)} baris terbaca · {formatNumber(preview.valid_rows)} valid ·{' '}
            {formatNumber(preview.invalid_rows)} bermasalah
          </p>
          <p className="mt-1 text-sm text-sg-neutral-600">
            Pemetaan akun ke karyawan: {formatNumber(preview.mapping.mapped_accounts)} terpetakan ·{' '}
            {/* FR-B-006 aturan 4, shown while the export can still be fixed. */}
            {formatNumber(preview.mapping.unowned_accounts)} Tanpa Pemilik
          </p>

          {/* FR-B-004 aturan 6 — the row-drop warning explains the consequence,
              not just the number (L-14 aturan 1). */}
          {preview.warnings.length > 0 && (
            <div className="mt-4 rounded-md border border-sg-warning-500 bg-sg-warning-50 px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-sg-warning-700">
                Perlu konfirmasi
              </p>
              <ul className="mt-2 space-y-3">
                {preview.warnings.map((w) => (
                  <li key={w.code} className="text-sm text-sg-warning-700">
                    <p>{w.message}</p>
                    {w.requires_confirmation && (
                      <label className="mt-1 flex items-start gap-2 text-sg-neutral-800">
                        <input
                          type="checkbox"
                          checked={confirmed.has(w.code)}
                          onChange={() =>
                            setConfirmed((cur) => {
                              const next = new Set(cur)
                              if (next.has(w.code)) next.delete(w.code)
                              else next.add(w.code)
                              return next
                            })
                          }
                          className="mt-0.5 h-4 w-4 accent-sg-accent-600"
                        />
                        <span>Saya telah memeriksa dan penurunan ini memang benar.</span>
                      </label>
                    )}
                  </li>
                ))}
              </ul>
              {needsNote && (
                <div className="mt-3">
                  <label htmlFor="note" className="block text-xs font-medium text-sg-neutral-700">
                    Keterangan (wajib)
                  </label>
                  <textarea
                    id="note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-sg-neutral-300 px-3 py-2 text-sm focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
                    placeholder="Alasan penurunan jumlah baris ini benar."
                  />
                </div>
              )}
            </div>
          )}

          {/* FR-B-004 aturan 4 — problem rows, with the correction file back out. */}
          {hasInvalid && (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-sg-neutral-900">
                  {formatNumber(preview.invalid_rows)} baris bermasalah
                </h3>
                <button
                  type="button"
                  onClick={downloadErrorFile}
                  className="rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-1.5 text-sm font-medium text-sg-neutral-800 hover:bg-sg-neutral-50"
                >
                  Unduh berkas koreksi
                </button>
              </div>
              <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-md border border-sg-neutral-200 bg-sg-neutral-50 p-2 text-xs text-sg-neutral-700">
                {preview.errors.slice(0, 50).map((issue, index) => (
                  <li key={`${issue.row}-${issue.column}-${index}`} className="tabular-nums">
                    Baris {issue.row} · {issue.column} · {issue.message}
                  </li>
                ))}
                {preview.errors.length > 50 && (
                  <li className="text-sg-neutral-500">
                    …dan {formatNumber(preview.errors.length - 50)} lagi. Lihat berkas koreksi.
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* L-14 aturan 3 — no default choice. */}
          <fieldset className="mt-5">
            <legend className="text-sm font-medium text-sg-neutral-900">Langkah akhir</legend>
            <div className="mt-2 space-y-2">
              <label className="flex items-center gap-2 text-sm text-sg-neutral-800">
                <input
                  type="radio"
                  name="proceed"
                  checked={proceed === 'cancel'}
                  onChange={() => setProceed('cancel')}
                  className="accent-sg-accent-600"
                />
                Batalkan dan perbaiki berkas
              </label>
              <label className="flex items-center gap-2 text-sm text-sg-neutral-800">
                <input
                  type="radio"
                  name="proceed"
                  checked={proceed === 'valid-only'}
                  onChange={() => setProceed('valid-only')}
                  className="accent-sg-accent-600"
                />
                {hasInvalid
                  ? `Lanjutkan dengan ${formatNumber(preview.valid_rows)} baris valid saja`
                  : `Lanjutkan dan simpan ${formatNumber(preview.valid_rows)} baris`}
              </label>
            </div>
          </fieldset>

          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={() => {
                setPreview(null)
                setProceed(null)
              }}
              className="rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm font-medium text-sg-neutral-800 hover:bg-sg-neutral-50"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={onCommit}
              disabled={busy || !canCommit}
              className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? 'Menyimpan…' : 'Proses'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}

/**
 * Client-side download of text the server already fetched with the session
 * token. The bytes never round-trip to a public URL; they arrive through the
 * Next server and are handed to the browser as a Blob.
 */
function triggerDownload(fileName: string, body: string): void {
  const blob = new Blob([body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
