'use client'

import { useState, useTransition } from 'react'
import { cancelCampaign, extendCampaign, launchCampaign } from './actions'

/**
 * FR-B-010 · campaign lifecycle controls on the detail screen.
 *
 * Which actions are offered follows the state machine, not free choice:
 *   DRAF                    -> Luncurkan, Batalkan
 *   BERJALAN / DIPERPANJANG -> Perpanjang, Batalkan
 * A closed, completed or cancelled campaign offers none. The API re-checks each
 * transition and its authority (a running campaign needs COMPLIANCE to cancel),
 * so a shown button is an offer, not a guarantee -- the refusal, if any, is the
 * rule speaking and is surfaced verbatim.
 */
export function CampaignLifecycle(props: {
  campaignId: string
  status: string
  currentDueDate: string
  canWrite: boolean
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'none' | 'extend' | 'cancel'>('none')
  const [dueDate, setDueDate] = useState(props.currentDueDate)
  const [reason, setReason] = useState('')

  const isDraft = props.status === 'DRAF'
  const isRunning = props.status === 'BERJALAN' || props.status === 'DIPERPANJANG'
  const anyAction = props.canWrite && (isDraft || isRunning)
  if (!anyAction) return null

  function act(fn: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setError(null)
    startTransition(async () => {
      const result = await fn()
      if (!result.ok) setError(result.message)
      else setMode('none')
    })
  }

  const { campaignId } = props

  return (
    <section className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4">
      <h2 className="text-md font-semibold text-sg-neutral-900">Tindakan kampanye</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {isDraft && (
          <Btn onClick={() => act(() => launchCampaign(campaignId))} disabled={pending}>
            {pending ? 'Meluncurkan…' : 'Luncurkan kampanye'}
          </Btn>
        )}
        {isRunning && (
          <Btn tone="muted" onClick={() => setMode(mode === 'extend' ? 'none' : 'extend')} disabled={pending}>
            Perpanjang tenggat
          </Btn>
        )}
        <Btn tone="danger" onClick={() => setMode(mode === 'cancel' ? 'none' : 'cancel')} disabled={pending}>
          Batalkan
        </Btn>
      </div>

      {mode === 'extend' && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            act(() => extendCampaign(campaignId, { dueDate, reason }))
          }}
        >
          <label className="block text-xs font-medium text-sg-neutral-700">
            Tenggat baru
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="mt-1 block min-h-11 rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
            />
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Alasan perpanjangan (min. 10 karakter)"
            className="min-h-11 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 placeholder:text-sg-neutral-400 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
          />
          <Btn tone="muted" type="submit" disabled={pending || reason.trim().length < 10}>
            {pending ? 'Menyimpan…' : 'Perpanjang'}
          </Btn>
        </form>
      )}

      {mode === 'cancel' && (
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            act(() => cancelCampaign(campaignId, reason))
          }}
        >
          <p className="text-xs text-sg-danger-700">
            Pembatalan tidak dapat dibatalkan. Keputusan yang sudah diambil tetap tersimpan sebagai arsip.
          </p>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Alasan pembatalan (min. 10 karakter)"
            className="min-h-11 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 placeholder:text-sg-neutral-400 focus:border-sg-danger-500 focus:outline focus:outline-2 focus:outline-sg-danger-500"
          />
          <Btn tone="danger" type="submit" disabled={pending || reason.trim().length < 10}>
            {pending ? 'Membatalkan…' : 'Konfirmasi pembatalan'}
          </Btn>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-2 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
          {error}
        </p>
      )}
    </section>
  )
}

function Btn(props: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  type?: 'button' | 'submit'
  tone?: 'accent' | 'muted' | 'danger'
}) {
  const tone = props.tone ?? 'accent'
  const cls =
    tone === 'accent'
      ? 'bg-sg-accent-600 text-sg-neutral-0 hover:bg-sg-accent-700'
      : tone === 'danger'
        ? 'border border-sg-danger-500 text-sg-danger-700 hover:bg-sg-danger-50'
        : 'border border-sg-neutral-300 text-sg-neutral-700 hover:bg-sg-neutral-50'
  return (
    <button
      type={props.type ?? 'button'}
      onClick={props.onClick}
      disabled={props.disabled}
      className={`inline-flex min-h-11 items-center rounded-md px-4 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600 disabled:opacity-50 ${cls}`}
    >
      {props.children}
    </button>
  )
}
