import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { hasPermission, requireUser } from '@/lib/session'
import type { ApplicationRow } from '../aplikasi/page'
import { AccessUploader } from './uploader'

/**
 * Screen L-14 · Unggah Data Akses — FR-B-004.
 *
 * Reading a snapshot is `application:read`; writing one is `snapshot:upload`,
 * held only by SEC_OFFICER (FRD Sec 1.4), because a snapshot is the evidence
 * that access was removed (K-1) and whoever writes one can close revocation
 * tickets. This screen gates on the write permission — the whole point of it is
 * to create a snapshot.
 */
export default async function UnggahAksesPage() {
  const user = await requireUser()
  if (!hasPermission(user, 'snapshot:upload')) notFound()

  const applications = await apiFetch<ApplicationRow[]>('/applications')

  return <AccessUploader applications={applications} />
}
