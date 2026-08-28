'use client'

import { useState } from 'react'
import { formatDateTime, formatNumber } from '@/lib/format'
import { signoffCampaign } from './actions'
import { REVIEW_TEXT } from './text'
import type { ReviewItem, SignoffResult } from './types'

/**
 * L-11 · the sign-off dialog.
 *
 * Three rules from the screen spec, each of which is a control and not a
 * courtesy:
 *
 * 1. The decision counts are shown BEFORE signing. A reviewer looking at
 *    "1.102 Pertahankan, 0 Cabut" may notice they have been too permissive.
 *    That realisation is only possible if the number is in front of them at the
 *    moment they can still act on it.
 * 2. The declaration checkbox starts unchecked, like every other decision
 *    control in this system.
 * 3. The irreversibility is stated before, not after.
 *
 * The password field is FR-X-003. It is posted to a server action, exchanged
 * for a short-lived step-up token server-side, and never stored in component
 * state beyond this dialog's lifetime.
 */
export function SignoffDialog(props: {
  campaignId: string
  items: ReviewItem[]
  onSigned: (result: SignoffResult) => void
}) {
  const [open, setOpen] = useState(false)
  const [declared, setDeclared] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const counts = countDecisions(props.items)
  const total = props.items.length
  const ticketed = (counts.CABUT ?? 0) + (counts.UBAH ?? 0)
  const applicationIds = [...new Set(props.items.map((i) => i.application.id))]

  async function submit() {
    setBusy(true)
    setError(null)

    const result = await signoffCampaign({
      campaignId: props.campaignId,
      password,
      statement: REVIEW_TEXT.signoff.statement,
      applicationIds,
    })

    setBusy(false)
    setPassword('')

    if (!result.ok) {
      setError(result.message)
      return
    }
    setOpen(false)
    props.onSigned(result.signoff)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600"
      >
        {REVIEW_TEXT.signoff.open}
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-sg-neutral-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="signoff-heading"
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-5"
      >
        <h2 id="signoff-heading" className="text-base font-semibold text-sg-neutral-900">
          {REVIEW_TEXT.signoff.heading}
        </h2>

        <h3 className="mt-4 text-sm font-medium text-sg-neutral-900">
          {REVIEW_TEXT.signoff.summaryHeading}
        </h3>
        <table className="mt-2 w-full text-sm">
          <caption className="sr-only">Jumlah keputusan menurut jenis</caption>
          <tbody className="divide-y divide-sg-neutral-100">
            {(['PERTAHANKAN', 'CABUT', 'UBAH', 'ALIHKAN'] as const).map((kind) => (
              <tr key={kind}>
                <th scope="row" className="py-1.5 text-left font-normal text-sg-neutral-700">
                  {REVIEW_TEXT.decision[kind]}
                </th>
                <td className="py-1.5 text-right tabular-nums text-sg-neutral-900">
                  {formatNumber(counts[kind] ?? 0)} item
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-sg-neutral-300">
              <th scope="row" className="py-1.5 text-left font-medium text-sg-neutral-900">
                {REVIEW_TEXT.signoff.total}
              </th>
              <td className="py-1.5 text-right font-medium tabular-nums text-sg-neutral-900">
                {formatNumber(total)} item
              </td>
            </tr>
          </tbody>
        </table>

        {ticketed > 0 && (
          <p className="mt-3 rounded-md border border-sg-info-500 bg-sg-info-50 px-3 py-2 text-sm text-sg-info-700">
            {REVIEW_TEXT.signoff.consequence(ticketed)}
          </p>
        )}

        <label className="mt-4 flex items-start gap-2 text-sm text-sg-neutral-800">
          {/* L-11 rule 2 — never checked by default. */}
          <input
            type="checkbox"
            checked={declared}
            onChange={(event) => setDeclared(event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-sg-neutral-300 accent-sg-accent-600"
          />
          <span>{REVIEW_TEXT.signoff.statement}</span>
        </label>

        <div className="mt-4">
          <label htmlFor="signoff-password" className="block text-sm font-medium text-sg-neutral-900">
            {REVIEW_TEXT.signoff.passwordLabel}
          </label>
          <input
            id="signoff-password"
            type="password"
            autoComplete="current-password"
            value={password}
            disabled={busy}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="signoff-password-hint"
            className="mt-1 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
          />
          <p id="signoff-password-hint" className="mt-1 text-xs text-sg-neutral-500">
            {REVIEW_TEXT.signoff.passwordHint}
          </p>
        </div>

        {/* L-11 rule 3 — stated before, not after. */}
        <p className="mt-4 rounded-md border border-sg-warning-500 bg-sg-warning-50 px-3 py-2 text-sm text-sg-warning-700">
          {REVIEW_TEXT.signoff.warning}
        </p>

        {error && (
          <p role="alert" className="mt-3 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setOpen(false)}
            disabled={busy}
            className="rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-4 py-2 text-sm text-sg-neutral-800 hover:bg-sg-neutral-50"
          >
            {REVIEW_TEXT.signoff.cancel}
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={busy || !declared || password.length === 0}
            className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:opacity-60"
          >
            {busy ? REVIEW_TEXT.signoff.submitting : REVIEW_TEXT.signoff.submit}
          </button>
        </div>
      </div>
    </div>
  )
}

export function SignedNotice(props: { signedAt: string }) {
  return (
    <p className="rounded-md border border-sg-success-500 bg-sg-success-50 px-3 py-2 text-sm text-sg-success-700">
      {REVIEW_TEXT.signoff.signedNotice(formatDateTime(props.signedAt))}
    </p>
  )
}

function countDecisions(items: ReviewItem[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const item of items) {
    if (item.decision) counts[item.decision.decision] = (counts[item.decision.decision] ?? 0) + 1
  }
  return counts
}
