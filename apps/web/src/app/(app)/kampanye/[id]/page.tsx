import Link from 'next/link'
import { notFound } from 'next/navigation'
import { apiFetch, ApiError } from '@/lib/api'
import { daysUntil, formatDate, formatDateTime, formatNumber, formatPercent } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, PageHeader, StatusBadge, type BadgeTone } from '@/components/ui'
import { CampaignLifecycle } from './campaign-lifecycle'
import { EvidencePackagePanel } from './evidence-package-panel'
import type { CampaignProgress, EvidencePackage, Signoff } from './types'

const STATUS_TONE: Record<string, BadgeTone> = {
  DRAF: 'neutral',
  DIJADWALKAN: 'info',
  BERJALAN: 'info',
  DIPERPANJANG: 'warning',
  MENUNGGU_SIGNOFF: 'warning',
  SELESAI: 'success',
  DITUTUP: 'success',
  DIBATALKAN: 'muted',
}

const STATUS_LABEL: Record<string, string> = {
  DRAF: 'Draf',
  DIJADWALKAN: 'Dijadwalkan',
  BERJALAN: 'Berjalan',
  DIPERPANJANG: 'Diperpanjang',
  MENUNGGU_SIGNOFF: 'Menunggu Sign-off',
  SELESAI: 'Selesai',
  DITUTUP: 'Ditutup',
  DIBATALKAN: 'Dibatalkan',
}

/**
 * Campaign detail — FR-B-016 monitoring, plus the FR-B-022/023 evidence pack.
 *
 * It composes three reads: progress (the numbers and scope), the sign-off
 * records (with their fingerprints), and the evidence pack if one exists. The
 * pack GET returns 404 until the pack is formed, which is not an error here --
 * it is the "not yet" state the panel offers to resolve, so a 404 is caught and
 * turned into a null pack rather than a failed page.
 */
export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requireUser()
  if (!hasPermission(user, 'campaign:read')) notFound()

  let progress: CampaignProgress
  try {
    progress = await apiFetch<CampaignProgress>(`/campaigns/${id}/progress`)
  } catch (error) {
    // A campaign outside the reader's scope comes back 404 from the API, which
    // is exactly what should render here (CLAUDE.md rule 3: not "forbidden",
    // simply "not found").
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const [signoffs, pack] = await Promise.all([
    apiFetch<Signoff[]>(`/campaigns/${id}/signoffs`).catch(() => [] as Signoff[]),
    apiFetch<EvidencePackage>(`/campaigns/${id}/evidence-package`).catch((error) => {
      if (error instanceof ApiError && error.status === 404) return null
      throw error
    }),
  ])

  const remaining = daysUntil(progress.due_date)
  const overdue = remaining !== null && remaining < 0 && progress.completion_percent < 100

  return (
    <div className="space-y-6">
      <PageHeader
        title={progress.name}
        description={
          <span>
            Tenggat {formatDate(progress.due_date)}
            {remaining !== null && (
              <span className={overdue ? 'text-sg-danger-700' : ''}>
                {overdue ? ` · terlewat ${Math.abs(remaining)} hari` : ` · ${remaining} hari lagi`}
              </span>
            )}
          </span>
        }
        action={
          <Link
            href="/kampanye"
            className="rounded-md border border-sg-neutral-300 px-3 py-2 text-sm text-sg-neutral-700 transition-colors hover:bg-sg-neutral-50"
          >
            ← Semua kampanye
          </Link>
        }
      />

      <div className="flex items-center gap-3">
        <StatusBadge tone={STATUS_TONE[progress.status] ?? 'neutral'}>
          {STATUS_LABEL[progress.status] ?? progress.status}
        </StatusBadge>
        <span className="text-sm text-sg-neutral-600 tabular-nums">
          {formatNumber(progress.decided_items)} dari {formatNumber(progress.total_items)} item diputuskan ·{' '}
          {formatPercent(progress.completion_percent)}
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-sg-neutral-200">
        <div
          className="h-full rounded-full bg-sg-accent-600 transition-all"
          style={{ width: `${progress.completion_percent}%` }}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4">
          <h2 className="text-md font-semibold text-sg-neutral-900">Cakupan</h2>
          <ul className="mt-2 divide-y divide-sg-neutral-100">
            {progress.applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-sg-neutral-800">
                  <Code className="text-xs text-sg-neutral-500">{a.code}</Code>
                  <span className="ml-2">{a.name}</span>
                </span>
                <span className="tabular-nums text-sg-neutral-600">{formatNumber(a.item_count)} item</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4">
          <h2 className="text-md font-semibold text-sg-neutral-900">
            Sign-off <span className="text-sm font-normal text-sg-neutral-500">({signoffs.length})</span>
          </h2>
          {signoffs.length === 0 ? (
            <p className="mt-2 text-sm text-sg-neutral-500">Belum ada sign-off.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {signoffs.map((s) => (
                <li key={s.id} className="text-sm">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-sg-neutral-900">
                      {s.signed_by.full_name}
                      <span className="ml-2 font-normal text-sg-neutral-500">Lapis {s.layer_no}</span>
                    </span>
                    <span className="text-xs text-sg-neutral-500 tabular-nums">
                      {formatDateTime(s.signed_at)}
                    </span>
                  </div>
                  <Code className="mt-0.5 block break-all text-2xs text-sg-neutral-500">
                    {s.content_hash}
                  </Code>
                  {!s.is_active && (
                    <span className="mt-1 inline-block text-xs text-sg-warning-700">
                      Dibuka kembali{s.reopen_reason ? `: ${s.reopen_reason}` : ''}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <CampaignLifecycle
        campaignId={id}
        status={progress.status}
        currentDueDate={progress.due_date}
        canWrite={hasPermission(user, 'campaign:write') || user.roles.includes('COMPLIANCE')}
      />

      <EvidencePackagePanel
        campaignId={id}
        initialPack={pack}
        canGenerate={
          hasPermission(user, 'campaign:write') &&
          ['MENUNGGU_SIGNOFF', 'SELESAI'].includes(progress.status)
        }
      />
    </div>
  )
}
