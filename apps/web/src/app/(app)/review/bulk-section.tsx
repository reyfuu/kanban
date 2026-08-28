'use client'

import { useRef, useState } from 'react'
import { formatDaysAgo } from '@/lib/format'
import { bulkDecide } from './actions'
import { KendaliKeputusan } from './kendali-keputusan'
import { REVIEW_TEXT } from './text'
import type { DecisionType, ReviewItem } from './types'

/**
 * Routine items, as compact selectable rows — L-10 rule 2.
 *
 * Only items the server marked `bulk_eligible` ever reach this component, and
 * L-10 rule 5 is why: an item that cannot take part shows no checkbox at all.
 * Rendering a checkbox and then refusing the request produces frustration with
 * no benefit, and teaches reviewers that the selection is unreliable.
 *
 * The server re-checks eligibility for every id anyway (K-4). This is the
 * courteous half of the control; the enforcing half is in the API.
 */
export function BulkSection(props: {
  items: ReviewItem[]
  onApplied: (appliedIds: string[]) => void
  disabled?: boolean
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [decision, setDecision] = useState<DecisionType | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [rejections, setRejections] = useState<{ item_id: string; reason: string }[]>([])
  const shownAt = useRef(Date.now())

  if (props.items.length === 0) return null

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function apply() {
    if (decision === null) {
      setMessage('Pilih salah satu keputusan terlebih dahulu.')
      return
    }
    setBusy(true)
    setMessage(null)
    setRejections([])

    const ids = [...selected]
    const result = await bulkDecide({
      itemIds: ids,
      decision,
      reason: reason.trim() ? reason.trim() : null,
      secondsSpent: Math.round((Date.now() - shownAt.current) / 1000),
    })

    setBusy(false)
    if (!result.ok) {
      setMessage(result.message)
      return
    }

    // FR-B-013 rule 2 — rejections are shown with their reasons, not swallowed.
    setRejections(result.result.rejections.map((r) => ({ item_id: r.item_id, reason: r.reason })))
    setMessage(
      result.result.rejected === 0
        ? `${result.result.applied} item diputuskan.`
        : `${result.result.applied} item diputuskan, ${result.result.rejected} ditolak.`,
    )
    const rejectedIds = new Set(result.result.rejections.map((r) => r.item_id))
    props.onApplied(ids.filter((id) => !rejectedIds.has(id)))
    setSelected(new Set())
  }

  const allVisible = props.items.every((i) => selected.has(i.id))

  return (
    <section className="mt-8 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
      <div className="border-b border-sg-neutral-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-sg-neutral-900">{REVIEW_TEXT.actions.bulkHeading}</h2>
        <p className="mt-1 text-xs text-sg-neutral-600">{REVIEW_TEXT.actions.bulkNote}</p>
      </div>

      <table className="w-full text-sm">
        <caption className="sr-only">Item review yang dapat diputuskan secara massal</caption>
        <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left text-xs uppercase tracking-wide text-sg-neutral-600">
          <tr>
            <th scope="col" className="w-10 px-3 py-2">
              <span className="sr-only">Pilih</span>
            </th>
            <th scope="col" className="px-3 py-2 font-medium">Karyawan</th>
            <th scope="col" className="px-3 py-2 font-medium">Aplikasi</th>
            <th scope="col" className="px-3 py-2 font-medium">Hak akses</th>
            <th scope="col" className="px-3 py-2 font-medium">Terakhir diakses</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-sg-neutral-100">
          {props.items.map((item) => (
            <tr key={item.id} className={selected.has(item.id) ? 'bg-sg-accent-50' : undefined}>
              {/* The padding is the touch target: 44px tall at the row level,
                  which is what a thumb actually lands on. */}
              <td className="px-3 py-3">
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  disabled={props.disabled || busy}
                  onChange={() => toggle(item.id)}
                  aria-label={`Pilih ${item.employee?.full_name ?? item.account_id} — ${item.entitlement.display_name}`}
                  // 20px box inside a 44px tap area. The box stays small
                  // because a row of giant checkboxes reads as a form rather
                  // than a list, but the target a finger has to hit is the
                  // padded span, not the box.
                  className="h-5 w-5 rounded border-sg-neutral-300 accent-sg-accent-600"
                />
              </td>
              <td className="px-3 py-2 text-sg-neutral-900">
                {item.employee?.full_name ?? item.account_id}
              </td>
              <td className="px-3 py-2 text-sg-neutral-700">{item.application.name}</td>
              <td className="px-3 py-2 text-sg-neutral-700">
                {item.entitlement.display_name}
                <span className="block text-xs text-sg-neutral-500">
                  {item.entitlement.business_description}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-sg-neutral-600">
                {item.context.last_access_at
                  ? formatDaysAgo(item.context.days_since_last_access)
                  : REVIEW_TEXT.context.neverAccessed}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="border-t border-sg-neutral-200 px-4 py-3">
        <button
          type="button"
          disabled={props.disabled || busy}
          onClick={() =>
            setSelected(allVisible ? new Set() : new Set(props.items.map((i) => i.id)))
          }
          className="inline-flex min-h-11 items-center text-sm text-sg-accent-700 underline-offset-2 hover:underline"
        >
          {REVIEW_TEXT.actions.bulkSelectAll}
        </button>

        {selected.size > 0 && (
          <div className="mt-3 rounded-md border border-sg-neutral-200 bg-sg-neutral-50 p-3">
            {/* Same component as the single-item card, so bulk has no default
                selection either. K-2 does not get a shortcut just because the
                action covers fifty rows -- if anything it matters more here. */}
            <KendaliKeputusan
              name="keputusan-massal"
              value={decision}
              onChange={setDecision}
              disabled={busy}
            />

            <label htmlFor="alasan-massal" className="mt-3 block text-sm font-medium text-sg-neutral-900">
              {REVIEW_TEXT.reason.label}{' '}
              <span className="font-normal text-sg-neutral-500">
                {decision !== null && decision !== 'PERTAHANKAN'
                  ? '(wajib — berlaku untuk seluruh item terpilih)'
                  : `(${REVIEW_TEXT.reason.optional})`}
              </span>
            </label>
            <textarea
              id="alasan-massal"
              rows={2}
              value={reason}
              disabled={busy}
              onChange={(event) => setReason(event.target.value)}
              placeholder={REVIEW_TEXT.reason.placeholder}
              className="mt-1 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 placeholder:text-sg-neutral-400 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
            />

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => void apply()}
                disabled={busy}
                className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:opacity-60"
              >
                {busy ? REVIEW_TEXT.actions.saving : REVIEW_TEXT.actions.bulkApply(selected.size)}
              </button>
            </div>
          </div>
        )}

        {message && (
          <p role="status" className="mt-3 text-sm text-sg-neutral-700">
            {message}
          </p>
        )}
        {rejections.length > 0 && (
          <ul className="mt-2 space-y-1 rounded-md border border-sg-warning-500 bg-sg-warning-50 px-3 py-2 text-sm text-sg-warning-700">
            {rejections.map((r) => (
              <li key={r.item_id}>{r.reason}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
