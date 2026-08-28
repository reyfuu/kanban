'use client'

import { useMemo, useState } from 'react'
import { daysUntil, formatDate, formatNumber, formatPercent } from '@/lib/format'
import { BulkSection } from './bulk-section'
import { DecisionCard } from './decision-card'
import { SignedNotice, SignoffDialog } from './signoff-dialog'
import { REVIEW_TEXT } from './text'
import { needsFullCard, type ReviewItem, type SignoffResult } from './types'

type Filter = 'all' | 'pending' | 'attention' | 'done'

/**
 * Screen L-10 · the reviewer's board.
 *
 * The split between attention-demanding cards and compact bulk rows is the
 * screen's whole reason for existing (L-10 rule 2). A uniform table of 400 rows
 * gets skimmed; separating the eight that matter is what directs the reviewer's
 * attention where the risk actually is.
 *
 * State lives here rather than being refetched per action so that "Simpan"
 * updates the item in place without a page reload (L-10 rule 6). The server is
 * still the authority -- each save returns the item as the server now holds it,
 * and that returned copy replaces the local one.
 */
export function ReviewBoard(props: { initialItems: ReviewItem[]; canSignoff: boolean }) {
  const [items, setItems] = useState(props.initialItems)
  const [filter, setFilter] = useState<Filter>('pending')
  const [signoff, setSignoff] = useState<SignoffResult | null>(null)

  const decided = items.filter((i) => i.decision !== null).length
  const total = items.length
  const campaign = items[0]?.campaign
  const due = campaign ? daysUntil(campaign.due_date) : null
  const signedAt = signoff?.signed_at ?? items.find((i) => i.signed_off_at)?.signed_off_at ?? null

  function replace(updated: ReviewItem) {
    setItems((current) => current.map((i) => (i.id === updated.id ? updated : i)))
  }

  function markDecided(ids: string[]) {
    // The bulk endpoint returns counts, not items. Rather than invent a decision
    // shape locally, the affected rows are simply moved out of "pending" by
    // status; the next load brings the authoritative decision back.
    const applied = new Set(ids)
    setItems((current) =>
      current.map((i) => (applied.has(i.id) ? { ...i, status: 'DIPUTUSKAN' as const } : i)),
    )
  }

  const visible = useMemo(() => {
    switch (filter) {
      case 'pending':
        return items.filter((i) => i.decision === null && i.status === 'BELUM_DIPUTUSKAN')
      case 'attention':
        return items.filter((i) => needsFullCard(i))
      case 'done':
        return items.filter((i) => i.decision !== null)
      default:
        return items
    }
  }, [items, filter])

  const cards = visible.filter(needsFullCard)
  const bulkRows = visible.filter((i) => !needsFullCard(i) && i.decision === null && !i.is_signed_off)
  const decidedRows = visible.filter((i) => !needsFullCard(i) && (i.decision !== null || i.is_signed_off))

  const counts: Record<Filter, number> = {
    all: items.length,
    pending: items.filter((i) => i.decision === null).length,
    attention: items.filter(needsFullCard).length,
    done: decided,
  }

  // Five table states (06-DESIGN §9.2 rule 4). Loading and error are handled by
  // the server component's Suspense and error boundaries; the two empty states
  // are distinguished here, because "you have no work" and "your filter matches
  // nothing" call for different actions from the reviewer.
  if (total === 0) {
    return (
      <EmptyState message={REVIEW_TEXT.states.empty} />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-sg-neutral-900">{REVIEW_TEXT.title}</h1>
          <span className="mt-2 block h-0.5 w-8 rounded-full bg-tri-navy" aria-hidden />
          {campaign && (
            <p className="mt-1 text-sm text-sg-neutral-700">
              {campaign.name}
              <span className="ml-2 text-sg-neutral-500">
                Tenggat {formatDate(campaign.due_date)}
                {due !== null && ` · ${REVIEW_TEXT.dueIn(due)}`}
              </span>
            </p>
          )}
          <p className="mt-1 max-w-2xl text-sm text-sg-neutral-600">{REVIEW_TEXT.intro}</p>
        </div>

        {props.canSignoff && signedAt === null && counts.pending === 0 && campaign && (
          <SignoffDialog campaignId={campaign.id} items={items} onSigned={setSignoff} />
        )}
      </div>

      {signedAt !== null && (
        <div className="mt-4">
          <SignedNotice signedAt={signedAt} />
        </div>
      )}

      <div className="mt-4">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-sg-neutral-200"
          role="progressbar"
          aria-valuenow={decided}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-label={REVIEW_TEXT.progress(decided, total)}
        >
          <div
            className="h-full bg-sg-accent-600"
            style={{ width: `${total === 0 ? 0 : (decided / total) * 100}%` }}
          />
        </div>
        <p className="mt-1 text-sm text-sg-neutral-600">
          {REVIEW_TEXT.progress(decided, total)} ·{' '}
          {formatPercent(total === 0 ? 0 : Math.round((decided / total) * 100))}
        </p>
      </div>

      {/*
       * A filter group, not tabs. The earlier role="tablist" promised a
       * tabpanel relationship that does not exist here (the results are one
       * live region, not four panels), and a screen reader announcing
       * "tab 2 of 4" for a filter misleads more than it helps. aria-pressed
       * describes what these buttons actually are: toggles over one list.
       */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Penyaring item review">
        {(['all', 'pending', 'attention', 'done'] as const).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={
              filter === key
                ? 'inline-flex min-h-11 items-center rounded-md border border-sg-accent-600 bg-sg-accent-50 px-4 text-sm font-medium text-sg-accent-700'
                : 'inline-flex min-h-11 items-center rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-4 text-sm text-sg-neutral-700 hover:bg-sg-neutral-50'
            }
          >
            {REVIEW_TEXT.filters[key]} {formatNumber(counts[key])}
          </button>
        ))}
      </div>

      {visible.length === 0 && (
        <div className="mt-6">
          <EmptyState
            message={
              counts.pending === 0 && filter === 'pending'
                ? REVIEW_TEXT.states.allDone
                : REVIEW_TEXT.states.emptyFiltered
            }
          />
        </div>
      )}

      {cards.length > 0 && (
        <div className="mt-6 space-y-4">
          {cards.map((item) => (
            <DecisionCard key={item.id} item={item} onDecided={replace} />
          ))}
        </div>
      )}

      <BulkSection items={bulkRows} onApplied={markDecided} disabled={signedAt !== null} />

      {decidedRows.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-sg-neutral-900">Sudah diputuskan</h2>
          <ul className="mt-2 divide-y divide-sg-neutral-100 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
            {decidedRows.map((item) => (
              <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-2 text-sm">
                <span className="text-sg-neutral-900">
                  {item.employee?.full_name ?? item.account_id}
                  <span className="ml-2 text-sg-neutral-600">{item.entitlement.display_name}</span>
                </span>
                <span className="text-sg-neutral-700">
                  {item.decision ? REVIEW_TEXT.decision[item.decision.decision] : '—'}
                  {item.decision?.bulk_applied && (
                    <span className="ml-2 text-xs text-sg-neutral-500">(massal)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function EmptyState(props: { message: string }) {
  return (
    <p className="rounded-lg border border-dashed border-sg-neutral-300 bg-sg-neutral-0 px-4 py-10 text-center text-sm text-sg-neutral-600">
      {props.message}
    </p>
  )
}
