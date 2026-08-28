import type { ReactNode } from 'react'

/**
 * Loading & error surfaces shared by every route segment.
 *
 * These exist because Next.js renders its own default fallbacks otherwise: an
 * untranslated English error screen, and nothing at all while a server
 * component awaits. For a tool whose interface language is Bahasa Indonesia
 * (CLAUDE.md), a default English crash screen is a real defect, not a polish
 * item, so the fallbacks live in one place and every segment reuses them.
 */

/** A grey block standing in for content that has not arrived yet. */
export function Skeleton(props: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-lg bg-sg-neutral-200 ${props.className ?? 'h-4 w-full'}`}
    />
  )
}

/**
 * The generic page-level loading state: a header placeholder plus a few rows.
 * `role="status"` with a visually hidden sentence so a screen reader is told
 * the page is loading rather than being handed an empty document.
 */
export function PageSkeleton(props: { rows?: number }) {
  const rows = props.rows ?? 5
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Memuat…</span>
      <div className="space-y-3 border-b border-sg-neutral-200 pb-5">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    </div>
  )
}

/**
 * The page-level error state. `reset` is the callback Next.js hands an error
 * boundary; showing it as a real button matters because most failures here are
 * a transient API timeout, and a retry costs the user nothing.
 *
 * The error's own message is deliberately not rendered: it can carry object
 * identifiers whose existence is itself confidential (kode aturan #3).
 */
export function ErrorPanel(props: { title?: string; description?: ReactNode; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-sg-danger-500 bg-sg-danger-50 px-4 py-6 text-center"
    >
      <p className="text-sm font-semibold text-sg-danger-700">
        {props.title ?? 'Halaman ini gagal dimuat.'}
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm text-sg-neutral-700">
        {props.description ??
          'Terjadi gangguan saat mengambil data. Coba muat ulang; bila berulang, hubungi administrator sistem.'}
      </p>
      {props.onRetry && (
        <button
          type="button"
          onClick={props.onRetry}
          className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-sg-danger-500 bg-sg-neutral-0 px-4 text-sm font-semibold text-sg-danger-700 transition-colors hover:bg-sg-danger-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-danger-500"
        >
          Coba lagi
        </button>
      )}
    </div>
  )
}

/**
 * An inline notice for partial failure — the case where the page rendered but
 * one of its sections could not load. Distinguishing this from "nothing to do"
 * is the point: a dash that means "gagal" and a zero that means "kosong" look
 * identical otherwise, and an auditor who reads a failed queue as an empty one
 * stops working on items that are actually waiting.
 */
export function PartialFailureNotice(props: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="rounded-lg border border-sg-warning-500 bg-sg-warning-50 px-3 py-2 text-sm text-sg-warning-700"
    >
      {props.children}
    </p>
  )
}
