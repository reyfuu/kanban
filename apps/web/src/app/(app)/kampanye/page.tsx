import Link from 'next/link'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { daysUntil, formatDate, formatNumber, formatPercent } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, EmptyState, PageHeader, StatusBadge, type BadgeTone } from '@/components/ui'

interface CampaignRow {
  id: string
  code: string
  name: string
  campaign_type: string
  status: string
  start_date: string
  due_date: string
  total_items: number
  decided_items: number
  completion_percent: number
  applications: { id: string; code: string; name: string }[]
}

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

/** Kampanye review — FR-B-008, FR-B-016. */
export default async function KampanyePage() {
  const user = await requireUser()
  if (!hasPermission(user, 'campaign:read')) notFound()

  const campaigns = await apiFetch<CampaignRow[]>('/campaigns')
  const canBuild = hasPermission(user, 'campaign:write')

  return (
    <div>
      <PageHeader
        title="Kampanye Review"
        description="Setiap kampanye meninjau kombinasi identitas dan hak akses pada cakupan yang ditetapkan, terhadap snapshot yang dibekukan saat peluncuran."
        action={
          canBuild ? (
            <Link
              href="/kampanye/baru"
              className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 shadow-sm transition-colors hover:bg-sg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600"
            >
              Susun kampanye
            </Link>
          ) : undefined
        }
      />

      {campaigns.length === 0 ? (
        <div className="mt-6">
          <EmptyState>Belum ada kampanye review.</EmptyState>
        </div>
      ) : (
        <ul className="mt-6 space-y-3">
          {campaigns.map((c) => {
            const remaining = daysUntil(c.due_date)
            const overdue = remaining !== null && remaining < 0 && c.completion_percent < 100

            return (
              <li
                key={c.id}
                className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4 shadow-sm transition-colors hover:border-sg-neutral-300"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-sg-neutral-900">
                      {c.name}
                      <Code className="ml-2 text-xs font-normal text-sg-neutral-500">{c.code}</Code>
                    </p>
                    <p className="mt-0.5 text-xs text-sg-neutral-600">
                      {c.campaign_type} · {formatDate(c.start_date)} – {formatDate(c.due_date)}
                      {remaining !== null && (
                        <span className={overdue ? ' text-sg-danger-700' : ''}>
                          {overdue
                            ? ` · terlewat ${Math.abs(remaining)} hari`
                            : ` · ${remaining} hari lagi`}
                        </span>
                      )}
                    </p>
                  </div>
                  <StatusBadge tone={STATUS_TONE[c.status] ?? 'neutral'}>
                    {STATUS_LABEL[c.status] ?? c.status}
                  </StatusBadge>
                </div>

                <p className="mt-2 text-xs text-sg-neutral-600">
                  {c.applications.map((a) => a.name).join(' · ') || 'Tanpa aplikasi'}
                </p>

                <div className="mt-3">
                  <div
                    className="h-2 w-full overflow-hidden rounded-full bg-sg-neutral-200"
                    role="progressbar"
                    aria-valuenow={c.decided_items}
                    aria-valuemin={0}
                    aria-valuemax={c.total_items}
                    aria-label={`${c.decided_items} dari ${c.total_items} item diputuskan`}
                  >
                    <div
                      className="h-full rounded-full bg-sg-accent-600 transition-all"
                      style={{ width: `${c.completion_percent}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-sg-neutral-600 tabular-nums">
                    {formatNumber(c.decided_items)} dari {formatNumber(c.total_items)} item diputuskan ·{' '}
                    {formatPercent(c.completion_percent)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
