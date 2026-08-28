import type { ReactNode } from 'react'

/**
 * Shared presentational primitives for the app screens.
 *
 * These exist so the calm, dense look 06-DESIGN asks for is enforced in one
 * place rather than re-typed per screen and drifting apart. None of them hold
 * business logic: a screen still decides what a status means, this only decides
 * how a badge, a page header, an empty state or a table frame looks.
 */

/** Page title + optional lead paragraph and right-aligned action (§4.1). */
export function PageHeader(props: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-sg-neutral-900">{props.title}</h1>
        {props.description && (
          <p className="mt-1 max-w-2xl text-sm text-sg-neutral-600">{props.description}</p>
        )}
      </div>
      {props.action}
    </div>
  )
}

/**
 * A status/label pill (§3.2). Tone maps to the semantic colours; every screen
 * that shows a status routes through here so the same state reads the same
 * everywhere. `neutral` is the quiet default for "no signal".
 */
export type BadgeTone = 'neutral' | 'muted' | 'info' | 'warning' | 'danger' | 'success' | 'system'

const BADGE_TONE: Record<BadgeTone, string> = {
  neutral: 'bg-sg-neutral-100 text-sg-neutral-700',
  muted: 'bg-sg-neutral-100 text-sg-neutral-600',
  info: 'bg-sg-info-50 text-sg-info-700',
  warning: 'bg-sg-warning-50 text-sg-warning-700',
  danger: 'bg-sg-danger-50 text-sg-danger-700',
  success: 'bg-sg-success-50 text-sg-success-700',
  system: 'bg-sg-system-50 text-sg-system-700',
}

export function StatusBadge(props: { tone: BadgeTone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-2xs font-semibold ${BADGE_TONE[props.tone]}`}
    >
      {props.children}
    </span>
  )
}

/**
 * The empty state (§3.11): a bordered dashed panel with a sentence, no
 * illustration. The doc is explicit that illustrations waste vertical space an
 * auditor would rather spend on data.
 */
export function EmptyState(props: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-dashed border-sg-neutral-300 bg-sg-neutral-0 px-4 py-10 text-center text-sm text-sg-neutral-600">
      {props.children}
    </p>
  )
}

/**
 * A framed, horizontally-scrollable table shell (§3.1). Callers supply the
 * <thead>/<tbody>; this owns the border, the overflow behaviour and the min
 * width so every table in the app has the same frame.
 */
export function TableFrame(props: { children: ReactNode; minWidth?: string; caption: string }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
      <table className={`w-full ${props.minWidth ?? 'min-w-[56rem]'} text-sm`}>
        <caption className="sr-only">{props.caption}</caption>
        {props.children}
      </table>
    </div>
  )
}

/**
 * A table header cell (§2.5: xs, semibold, uppercase, 0.04em tracking). Kept as
 * a component so the exact type treatment is not re-typed and slowly diverging
 * across five tables.
 */
export function Th(props: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={`px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-sg-neutral-500 ${props.className ?? ''}`}
    >
      {props.children}
    </th>
  )
}

/**
 * A monospaced code value (§2.5): entitlement codes, ticket numbers, document
 * codes, fingerprints -- the values that get compared character by character.
 */
export function Code(props: { children: ReactNode; className?: string }) {
  return <span className={`font-mono ${props.className ?? ''}`}>{props.children}</span>
}
