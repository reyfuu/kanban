import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { hasPermission, requireUser } from '@/lib/session'
import type { ApplicationRow } from '../../aplikasi/page'
import { CampaignWizard } from './wizard'

interface SessionUser {
  id: string
  full_name: string
}

/**
 * Screen L-09 · Penyusun Kampanye Review — FR-B-008, FR-B-009.
 *
 * The candidate fallback reviewers are the current user for now. FR-B-009 rule 1
 * makes the fallback mandatory, and a user-directory endpoint (FR-X-014) does
 * not exist yet -- so rather than offer an empty select and let the author reach
 * step 4 before discovering they cannot proceed, the one identity we can resolve
 * server-side is offered and the gap is stated here.
 */
export default async function KampanyeBaruPage() {
  const user = await requireUser()
  if (!hasPermission(user, 'campaign:write')) notFound()

  const applications = await apiFetch<ApplicationRow[]>('/applications')
  const reviewers: SessionUser[] = [{ id: user.id, full_name: `${user.full_name} (Anda)` }]

  return <CampaignWizard applications={applications} reviewers={reviewers} />
}
