'use client'

import { useState, useTransition } from 'react'
import { claimTicket, completeTicket, exceptTicket, verifyTicketNow } from './actions'

/**
 * The per-ticket action controls (FR-B-019 s.d. FR-B-021), shown only to a
 * ticket:execute holder. Which buttons appear depends on the ticket's status,
 * because the lifecycle is a path, not a free choice:
 *
 *   TERBUKA        -> Klaim (start work) or Kecualikan (with a reason)
 *   DALAM_PROSES   -> Tandai selesai (note required) or Kecualikan
 *   MENUNGGU_VERIFIKASI / GAGAL_DIVERIFIKASI -> Verifikasi sekarang
 *
 * "Tandai selesai" moves the ticket to MENUNGGU_VERIFIKASI; it never closes it.
 * Closure is decided by the next snapshot in "Verifikasi sekarang", never by the
 * person who did the work (K-1). The API re-checks every transition, so these
 * buttons only offer the moves that are currently legal.
 */
export function TicketActions(props: { ticketId: string; status: string; canExecute: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [reason, setReason] = useState('')
  const [mode, setMode] = useState<'none' | 'complete' | 'except'>('none')

  if (!props.canExecute) return <span className="text-xs text-sg-neutral-400">—</span>

  function act(fn: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) setError(result.message)
      else setMode('none')
    })
  }

  const { ticketId, status } = props

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        {status === 'TERBUKA' && (
          <ActionButton onClick={() => act(() => claimTicket(ticketId))} disabled={pending}>
            Klaim
          </ActionButton>
        )}
        {status === 'DALAM_PROSES' && (
          <ActionButton onClick={() => setMode(mode === 'complete' ? 'none' : 'complete')} disabled={pending}>
            Tandai selesai
          </ActionButton>
        )}
        {(status === 'TERBUKA' || status === 'DALAM_PROSES') && (
          <ActionButton
            tone="muted"
            onClick={() => setMode(mode === 'except' ? 'none' : 'except')}
            disabled={pending}
          >
            Kecualikan
          </ActionButton>
        )}
        {(status === 'MENUNGGU_VERIFIKASI' || status === 'GAGAL_DIVERIFIKASI') && (
          <ActionButton onClick={() => act(() => verifyTicketNow(ticketId))} disabled={pending}>
            {pending ? 'Memeriksa…' : 'Verifikasi sekarang'}
          </ActionButton>
        )}
      </div>

      {mode === 'complete' && (
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            act(() => completeTicket(ticketId, { executionNote: note }))
          }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Keterangan pelaksanaan (min. 10 karakter)"
            className="min-h-11 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 placeholder:text-sg-neutral-400 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
          />
          <ActionButton type="submit" disabled={pending || note.trim().length < 10}>
            {pending ? 'Menyimpan…' : 'Kirim'}
          </ActionButton>
        </form>
      )}

      {mode === 'except' && (
        <form
          className="space-y-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            act(() => exceptTicket(ticketId, reason))
          }}
        >
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Alasan pengecualian (min. 10 karakter)"
            className="min-h-11 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 placeholder:text-sg-neutral-400 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
          />
          <ActionButton tone="muted" type="submit" disabled={pending || reason.trim().length < 10}>
            {pending ? 'Menyimpan…' : 'Kecualikan'}
          </ActionButton>
        </form>
      )}

      {error && (
        <p role="alert" className="text-xs text-sg-danger-700">
          {error}
        </p>
      )}
    </div>
  )
}

function ActionButton(props: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  tone?: 'accent' | 'muted'
}) {
  const tone = props.tone ?? 'accent'
  const cls =
    tone === 'accent'
      ? 'border-sg-accent-300 bg-sg-accent-50 text-sg-accent-700 hover:bg-sg-accent-100'
      : 'border-sg-neutral-300 bg-sg-neutral-0 text-sg-neutral-700 hover:bg-sg-neutral-50'
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`inline-flex min-h-11 items-center whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-sg-accent-600 disabled:opacity-50 ${cls}`}
    >
      {props.children}
    </button>
  )
}
