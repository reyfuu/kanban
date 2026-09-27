'use server'

import { cookies } from 'next/headers'
import { apiFetch, ApiError, SESSION_COOKIE } from '@/lib/api'

/**
 * Server actions for screen L-14 (FR-B-004).
 *
 * Two of these cannot go through `apiFetch`, and the reason is the same for
 * both: the SIGAP session token lives in an httpOnly cookie on the Next server,
 * never in the browser, so the browser cannot call the API directly for the
 * multipart upload or the CSV downloads. Every byte still passes through the
 * Next server, which attaches the bearer token the browser never sees.
 *
 * `validate` writes nothing; `commit` writes the snapshot. That split is the
 * whole shape of FR-B-004 aturan 3 and 6 — the author sees exactly what the
 * file will do before anything lands.
 */
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001'

export interface UploadWarning {
  code: string
  severity: string
  message: string
  requires_confirmation: boolean
}

export interface UploadIssue {
  row: number
  column: string
  code: string
  message: string
  value: string | null
}

export interface ValidationPreview {
  validation_id: string
  total_rows: number
  valid_rows: number
  invalid_rows: number
  warnings: UploadWarning[]
  errors: UploadIssue[]
  mapping: { mapped_accounts: number; unowned_accounts: number }
  error_file_url: string
  expires_at: string
}

export type Result<T> = ({ ok: true } & T) | { ok: false; message: string }

async function bearer(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null
}

/**
 * FR-B-004 aturan 3 · upload and validate, writing nothing.
 *
 * The file arrives from the browser as FormData; it is forwarded to the API
 * unchanged rather than parsed here, because the row rules that decide whether
 * an export becomes review scope live on the server and must be the only ones
 * that run.
 */
export async function validateUpload(form: FormData): Promise<Result<{ preview: ValidationPreview }>> {
  const file = form.get('file')
  const applicationId = form.get('application_id')
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: 'Pilih berkas CSV terlebih dahulu.' }
  }
  if (typeof applicationId !== 'string' || applicationId === '') {
    return { ok: false, message: 'Aplikasi tujuan belum dipilih.' }
  }

  const token = await bearer()
  const forwarded = new FormData()
  forwarded.set('application_id', applicationId)
  forwarded.set('file', file, file.name)

  const response = await fetch(`${API_BASE}/api/v1/snapshots/upload/validate`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: forwarded,
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    return { ok: false, message: payload?.detail ?? 'Validasi gagal karena kesalahan yang tidak terduga.' }
  }
  return { ok: true, preview: payload?.data as ValidationPreview }
}

/**
 * FR-B-004 aturan 5 · turn a validated upload into a snapshot.
 *
 * Runs through `apiFetch` because the body is plain JSON. The response also
 * reports how many pending revocation tickets this snapshot closed (K-1),
 * which is surfaced to the author so the upload's downstream effect is not
 * invisible.
 */
export async function commitUpload(input: {
  validationId: string
  skipInvalidRows: boolean
  confirmWarnings: string[]
  confirmationNote?: string
}): Promise<Result<{ snapshotId: string; lineCount: number; verification: { checked: number; closed: number; failed: number } }>> {
  try {
    const data = await apiFetch<{
      snapshot_id: string
      line_count: number
      revocation_verification: { checked: number; closed: number; failed: number }
    }>('/snapshots/upload', {
      method: 'POST',
      body: {
        validation_id: input.validationId,
        skip_invalid_rows: input.skipInvalidRows,
        confirm_warnings: input.confirmWarnings,
        ...(input.confirmationNote ? { confirmation_note: input.confirmationNote } : {}),
      },
    })
    return {
      ok: true,
      snapshotId: data.snapshot_id,
      lineCount: data.line_count,
      verification: data.revocation_verification,
    }
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message }
    return { ok: false, message: 'Terjadi kesalahan yang tidak terduga.' }
  }
}

/** FR-B-004 aturan 1 · the per-application template, returned as text for a client-side download. */
export async function fetchTemplate(applicationId: string): Promise<Result<{ fileName: string; body: string }>> {
  return fetchCsv(`/applications/${applicationId}/upload-template`, `templat-akses.csv`)
}

/** FR-B-004 aturan 4 · the rejected rows with their reasons, as text for a client-side download. */
export async function fetchErrorFile(validationId: string): Promise<Result<{ fileName: string; body: string }>> {
  return fetchCsv(`/snapshots/upload/${validationId}/errors.csv`, `kesalahan-unggahan.csv`)
}

async function fetchCsv(path: string, fallbackName: string): Promise<Result<{ fileName: string; body: string }>> {
  const token = await bearer()
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    cache: 'no-store',
  })
  if (!response.ok) {
    return { ok: false, message: 'Berkas tidak dapat diunduh.' }
  }
  const body = await response.text()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const match = /filename="([^"]+)"/.exec(disposition)
  return { ok: true, fileName: match?.[1] ?? fallbackName, body }
}
