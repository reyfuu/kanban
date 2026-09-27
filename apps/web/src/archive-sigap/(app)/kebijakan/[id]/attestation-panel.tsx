'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { submitAttestation } from './actions'

/**
 * FR-C-020 aturan 1 & 2 · the attestation control.
 *
 * The button starts disabled and opens only after the reader has spent real
 * time on the page and, for a long document, scrolled to the end. Both are
 * measured here because only the browser can observe them.
 *
 * None of that is the control. The client is not trustworthy -- anyone can post
 * to the endpoint directly -- and the server independently enforces a floor and
 * records what it was told. What this component provides is the honest path:
 * it makes the intended behaviour the easy one, and it tells the reader plainly
 * what is still required rather than presenting a dead button with no
 * explanation.
 */
export function AttestationPanel(props: {
  taskId: string
  documentTitle: string
  version: string
  /** True when the document is long enough to require scrolling to the end. */
  requiresScroll: boolean
}) {
  const router = useRouter()
  const [seconds, setSeconds] = useState(0)
  const [reachedEnd, setReachedEnd] = useState(!props.requiresScroll)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const sentinel = useRef<HTMLDivElement>(null)

  /** Minimum dwell time, matching the server's floor. */
  const MIN_SECONDS = 5

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!props.requiresScroll) return
    const node = sentinel.current
    if (!node) return
    // An IntersectionObserver on a sentinel at the end of the document, rather
    // than a scroll-position calculation: it keeps working when the layout
    // changes, when the window is resized, and on a phone where the viewport
    // moves as the address bar hides.
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setReachedEnd(true)
      },
      { threshold: 0.5 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [props.requiresScroll])

  const waitingOnTime = seconds < MIN_SECONDS
  const waitingOnScroll = props.requiresScroll && !reachedEnd
  const blocked = waitingOnTime || waitingOnScroll

  async function attest() {
    setError(null)
    setPending(true)
    const result = await submitAttestation(props.taskId, seconds, reachedEnd)
    setPending(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.refresh()
  }

  return (
    <>
      {/* Sits at the end of the document body; crossing it is what "read to the
          end" means in practice. */}
      <div ref={sentinel} aria-hidden className="h-px w-full" />

      <section className="mt-8 rounded-lg border-2 border-tri-navy bg-tri-navy-tint p-4">
        <h2 className="text-md font-semibold text-sg-neutral-900">
          Pernyataan telah membaca
        </h2>
        <p className="mt-1 text-sm text-sg-neutral-700">
          Dengan menekan tombol di bawah, Anda menyatakan telah membaca dan memahami{' '}
          <span className="font-medium">{props.documentTitle}</span> versi {props.version}.
          Pernyataan ini tercatat beserta waktu, alamat IP, dan lama dokumen dibuka, dan{' '}
          <span className="font-medium">tidak dapat dibatalkan</span>.
        </p>

        {/* The reader is told what is still missing. A disabled button with no
            explanation is the most common way this requirement gets
            implemented, and it just looks broken. */}
        {blocked && (
          <p className="mt-3 text-sm text-sg-neutral-600" aria-live="polite">
            {waitingOnScroll
              ? 'Gulir sampai bagian akhir dokumen untuk mengaktifkan tombol.'
              : `Tombol aktif dalam ${MIN_SECONDS - seconds} detik.`}
          </p>
        )}

        {error && (
          <p role="alert" className="mt-3 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={attest}
          disabled={blocked || pending}
          className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-tri-navy px-5 text-sm font-semibold text-tri-on-primary transition-colors hover:bg-tri-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-navy disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? 'Mencatat…' : 'Saya telah membaca dokumen ini'}
        </button>
      </section>
    </>
  )
}
