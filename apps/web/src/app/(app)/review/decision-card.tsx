'use client'

import { useRef, useState } from 'react'
import { formatDate, formatDateTime, formatDaysAgo } from '@/lib/format'
import { decideItem } from './actions'
import { KendaliKeputusan } from './kendali-keputusan'
import { REVIEW_TEXT } from './text'
import type { DecisionType, ReviewItem } from './types'

/**
 * A full-attention review card — L-10 rule 2.
 *
 * Used for items that are privileged, high risk, in SoD conflict, or carrying an
 * anomaly. The visual weight is the point: these are the items where a wrong
 * "Pertahankan" costs something, and the layout is what moves the reviewer's
 * attention to them rather than letting them scroll past in a uniform table.
 *
 * The entitlement description is always visible, never behind a tooltip
 * (L-10 rule 3). A line manager will not hover four hundred rows, and an
 * approval given without understanding what was approved is the failure this
 * whole module exists to prevent.
 */
export function DecisionCard(props: { item: ReviewItem; onDecided: (item: ReviewItem) => void }) {
  const { item } = props
  const locked = item.is_signed_off

  const [decision, setDecision] = useState<DecisionType | null>(item.decision?.decision ?? null)
  const [reason, setReason] = useState(item.decision?.reason ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // FR-B-014 feeds on this. Measured from when the card was first shown, not
  // from a value the client is free to invent -- it is still client-reported,
  // and the server treats it as a signal for the rubber-stamping report rather
  // than as a fact it enforces anything on.
  const shownAt = useRef(Date.now())
  const cardRef = useRef<HTMLDivElement>(null)

  // L-10 keyboard support: 1-4 pick a decision, Enter saves.
  function onKeyDown(event: React.KeyboardEvent) {
    if (locked) return
    const target = event.target as HTMLElement
    const typing = target.tagName === 'TEXTAREA' || target.tagName === 'INPUT'

    if (!typing && ['1', '2', '3', '4'].includes(event.key)) {
      const options: DecisionType[] = ['PERTAHANKAN', 'CABUT', 'UBAH', 'ALIHKAN']
      setDecision(options[Number(event.key) - 1]!)
      event.preventDefault()
      return
    }
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || !typing)) {
      void save()
      event.preventDefault()
    }
  }

  // The reason requirement depends on the decision AND the item. The server
  // decides for real; this only tells the reviewer why the box is required
  // before they hit a refusal (L-10 rule 4).
  const reasonRequired =
    decision !== null && (decision !== 'PERTAHANKAN' || item.requires_reason_even_if_retained)
  const reasonLabel = reasonRequiredLabel(decision, item)

  async function save() {
    if (decision === null) {
      setError('Pilih salah satu keputusan terlebih dahulu.')
      return
    }
    setSaving(true)
    setError(null)

    const result = await decideItem({
      itemId: item.id,
      decision,
      reason: reason.trim() ? reason.trim() : null,
      secondsSpent: Math.round((Date.now() - shownAt.current) / 1000),
    })

    setSaving(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setSaved(true)
    props.onDecided(result.item)
  }

  const severity = item.flags.find((f) => f.type === 'SOD_CONFLICT') ? 'danger' : 'warning'

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={`rounded-lg border bg-sg-neutral-0 ${
        severity === 'danger' ? 'border-sg-danger-500' : 'border-sg-warning-500'
      }`}
    >
      {item.flags.length > 0 && (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-t-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide ${
            severity === 'danger'
              ? 'bg-sg-danger-50 text-sg-danger-700'
              : 'bg-sg-warning-50 text-sg-warning-700'
          }`}
        >
          {item.flags.map((flag) => (
            <span key={flag.rule_code}>
              {flag.type === 'SOD_CONFLICT' ? REVIEW_TEXT.badge.sodConflict : REVIEW_TEXT.badge.anomaly}
            </span>
          ))}
        </div>
      )}

      <div className="p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-sg-neutral-900">
            {item.employee?.full_name ?? item.account_id}
            <span className="ml-2 font-normal text-sg-neutral-600">
              {item.employee
                ? `${item.employee.employee_number} · ${item.employee.job_title ?? ''} · ${item.employee.org_unit.name}`
                : REVIEW_TEXT.context.account}
            </span>
          </p>
          {locked && (
            <span className="rounded-full bg-sg-neutral-100 px-2 py-0.5 text-xs text-sg-neutral-600">
              {REVIEW_TEXT.badge.signed}
            </span>
          )}
        </div>

        <p className="mt-3 text-sm text-sg-neutral-700">{item.application.name}</p>

        <div className="mt-1 rounded-md border border-sg-neutral-200 bg-sg-neutral-50 p-3">
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-sg-neutral-900">
            {item.entitlement.display_name}
            {item.entitlement.is_privileged && (
              <span className="rounded bg-sg-warning-50 px-1.5 py-0.5 text-xs font-semibold text-sg-warning-700">
                {REVIEW_TEXT.badge.privileged}
              </span>
            )}
            {item.entitlement.risk_level === 'KRITIS' && (
              <span className="rounded bg-sg-danger-50 px-1.5 py-0.5 text-xs font-semibold text-sg-danger-700">
                {REVIEW_TEXT.badge.critical}
              </span>
            )}
          </p>
          {/* L-10 rule 3 — always visible. */}
          <p className="mt-1 text-sm text-sg-neutral-700">
            {item.entitlement.business_description}
          </p>
        </div>

        <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm text-sg-neutral-600 sm:grid-cols-2">
          <div className="flex gap-1">
            <dt>{REVIEW_TEXT.context.grantedAt}</dt>
            <dd className="text-sg-neutral-800">
              {formatDate(item.context.granted_at)}
              {item.context.granted_by && ` ${REVIEW_TEXT.context.grantedBy} ${item.context.granted_by}`}
            </dd>
          </div>
          <div className="flex gap-1">
            <dt>{REVIEW_TEXT.context.lastAccess}</dt>
            <dd className="text-sg-neutral-800">
              {item.context.last_access_at
                ? `${formatDateTime(item.context.last_access_at)} (${formatDaysAgo(item.context.days_since_last_access)})`
                : REVIEW_TEXT.context.neverAccessed}
            </dd>
          </div>
        </dl>

        {item.flags.map((flag) => (
          // L-10 rule 7 — the business risk in a sentence, not just a rule code.
          <p
            key={flag.rule_code}
            className="mt-3 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700"
          >
            {flag.message}
            <span className="ml-1 text-xs text-sg-danger-700/80">({flag.rule_code})</span>
          </p>
        ))}

        <div className="mt-4">
          <KendaliKeputusan
            name={`keputusan-${item.id}`}
            value={decision}
            onChange={(value) => {
              setDecision(value)
              setSaved(false)
            }}
            disabled={locked || saving}
          />
        </div>

        <div className="mt-3">
          <label htmlFor={`alasan-${item.id}`} className="block text-sm font-medium text-sg-neutral-900">
            {REVIEW_TEXT.reason.label}{' '}
            <span
              className={
                reasonRequired ? 'font-normal text-sg-danger-700' : 'font-normal text-sg-neutral-500'
              }
            >
              ({reasonLabel})
            </span>
          </label>
          <textarea
            id={`alasan-${item.id}`}
            rows={2}
            value={reason}
            disabled={locked || saving}
            onChange={(event) => setReason(event.target.value)}
            placeholder={REVIEW_TEXT.reason.placeholder}
            aria-describedby={`alasan-hint-${item.id}`}
            className="mt-1 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 placeholder:text-sg-neutral-400 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-offset-0 focus:outline-sg-accent-600 disabled:bg-sg-neutral-50"
          />
          <p id={`alasan-hint-${item.id}`} className="mt-1 text-xs text-sg-neutral-500">
            {REVIEW_TEXT.reason.hint}
          </p>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
            {error}
          </p>
        )}

        {!locked && (
          <div className="mt-4 flex items-center justify-end gap-3">
            {saved && (
              <span role="status" className="text-sm text-sg-success-700">
                Tersimpan.
              </span>
            )}
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600 disabled:opacity-60"
            >
              {saving ? REVIEW_TEXT.actions.saving : REVIEW_TEXT.actions.save}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/** L-10 rule 4 — say *why* it is required, not just that it is. */
function reasonRequiredLabel(decision: DecisionType | null, item: ReviewItem): string {
  if (decision === null) {
    return item.requires_reason_even_if_retained
      ? (item.reason_requirement_label ?? REVIEW_TEXT.reason.optional)
      : REVIEW_TEXT.reason.optional
  }
  if (decision !== 'PERTAHANKAN') return 'wajib — keputusan selain Pertahankan'
  return item.requires_reason_even_if_retained
    ? (item.reason_requirement_label ?? 'wajib')
    : REVIEW_TEXT.reason.optional
}
