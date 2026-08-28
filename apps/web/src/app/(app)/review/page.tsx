import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { hasPermission, requireUser } from '@/lib/session'
import { ReviewBoard } from './review-board'
import type { ReviewItem } from './types'

/**
 * Screen L-10 · Review Saya — FR-B-011 s.d. FR-B-015.
 *
 * The most critical screen in the system according to 05-UIUX-FLOW: the quality
 * of the whole access review is decided here. If this screen makes rubber
 * stamping easy, the campaign produces a signed record of nothing.
 *
 * The permission check below is for the reviewer's benefit, not security. The
 * API refuses the request regardless of what this page rendered (FR-X-005 rule
 * 3), and which rows come back is decided in the repository, not here.
 */
export default async function ReviewPage() {
  const user = await requireUser()
  if (!hasPermission(user, 'review:read')) notFound()

  const items = await apiFetch<ReviewItem[]>('/my/review-items?limit=500')

  return (
    <ReviewBoard initialItems={items} canSignoff={hasPermission(user, 'campaign:signoff')} />
  )
}
