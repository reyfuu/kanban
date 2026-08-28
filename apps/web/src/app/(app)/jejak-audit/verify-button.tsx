'use client'

import { useState, useTransition } from 'react'
import { verifyChain, type ChainResult } from './actions'

/**
 * FR-X-008 rule 5.
 *
 * The result is shown verbatim, including a failure. A verification control
 * that quietly softens bad news is worse than none: the whole value of the
 * chain is that it can say "this has been tampered with" and be believed.
 */
export function VerifyChainButton() {
  const [result, setResult] = useState<ChainResult | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="text-right">
      <button
        type="button"
        disabled={pending}
        onClick={() => startTransition(async () => setResult(await verifyChain()))}
        className="rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm font-medium text-sg-neutral-800 hover:bg-sg-neutral-50 disabled:opacity-60"
      >
        {pending ? 'Memeriksa…' : 'Periksa integritas rantai'}
      </button>

      {result && (
        <p
          role="status"
          className={
            result.is_valid
              ? 'mt-2 rounded-md border border-sg-success-500 bg-sg-success-50 px-3 py-2 text-sm text-sg-success-700'
              : 'mt-2 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700'
          }
        >
          {result.is_valid
            ? `Rantai utuh — ${result.rows_checked} catatan diperiksa.`
            : `Rantai terputus pada catatan ${result.broken_at}.`}
        </p>
      )}
    </div>
  )
}
