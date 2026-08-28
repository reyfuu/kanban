import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { hasPermission, requireUser } from '@/lib/session'
import type { ApplicationRow } from '../../aplikasi/page'
import { CampaignWizard } from './wizard'

interface SessionUser {
  id: string
  full_name: string
  job_title?: string | null
}

/**
 * Screen L-09 · Penyusun Kampanye Review — FR-B-008, FR-B-009.
 *
 * The fallback reviewer (FR-B-009 rule 1) is now chosen from the active user
 * list, so a campaign can be built for someone other than the author. The
 * author themselves is kept at the top of the list as the obvious default.
 */
export default async function KampanyeBaruPage() {
  const user = await requireUser()
  if (!hasPermission(user, 'campaign:write')) notFound()

  const [applications, candidates] = await Promise.all([
    apiFetch<ApplicationRow[]>('/applications'),
    apiFetch<SessionUser[]>('/users').catch(() => [] as SessionUser[]),
  ])

  // The author first (labelled), then everyone else, de-duplicated.
  const others = candidates.filter((c) => c.id !== user.id)
  const reviewers: SessionUser[] = [
    { id: user.id, full_name: `${user.full_name} (Anda)` },
    ...others.map((c) => ({
      id: c.id,
      full_name: c.job_title ? `${c.full_name} · ${c.job_title}` : c.full_name,
    })),
  ]

  return <CampaignWizard applications={applications} reviewers={reviewers} />
}
