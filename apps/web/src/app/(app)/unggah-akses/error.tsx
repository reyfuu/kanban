'use client'

import { ErrorPanel } from '@/components/feedback'

/**
 * Segment error boundary. Next.js requires a client component here and hands
 * it `reset`, which re-renders the segment -- the right affordance for the
 * transient API failures that cause most of these.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorPanel onRetry={reset} />
}
