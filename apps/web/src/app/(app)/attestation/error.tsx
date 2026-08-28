'use client'

import { ErrorPanel } from '@/components/feedback'

/** Segment error boundary; `reset` retries transient API failures. */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel onRetry={reset} />
}
