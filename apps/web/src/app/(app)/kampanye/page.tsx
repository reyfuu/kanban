import Link from 'next/link'
import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { daysUntil, formatDate, formatNumber, formatPercent } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'

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

const STATUS_STYLE: Record<string, string> = {
  DRAF: 'bg-sg-neutral-100 text-sg-neutral-700',
  DIJADWALKAN: 'bg-sg-info-50 text-sg-info-700',
  BERJALAN: 'bg-sg-info-50 text-sg-info-700',
  DIPERPANJANG: 'bg-sg-warning-50 text-sg-warning-700',
  MENUNGGU_SIGNOFF: 'bg-sg-warning-50 text-sg-warning-700',
  SELESAI: 'bg-sg-success-50 text-sg-success-700',
  DITUTUP: 'bg-sg-success-50 text-sg-success-700',
  DIBATALKAN: 'bg-sg-neutral-100 text-sg-neutral-600',
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-sg-neutral-900">Kampanye Review</h1>
          <p className="mt-1 max-w-2xl text-sm text-sg-neutral-600">
            Setiap kampanye meninjau kombinasi identitas dan hak akses pada cakupan yang
            ditetapkan, terhadap snapshot yang dibekukan saat peluncuran.
          </p>
        </div>
        {canBuild && (
          <Link
            href="/kampanye/baru"
            className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700"
          >
            Susun kampanye
          </Link>
        )}
      </div>

      {campaigns.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-sg-neutral-300 bg-sg-neutral-0 px-4 py-10 text-center text-sm text-sg-neutral-600">
          Belum ada kampanye review.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {campaigns.map((c) => {
            const remaining = daysUntil(c.due_date)
            const overdue = remaining !== null && remaining < 0 && c.completion_percent < 100

            return (
              <li
                key={c.id}
                className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-sg-neutral-900">
                      {c.name}
                      <span className="ml-2 font-normal text-sg-neutral-500">{c.code}</span>
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
                  <span
                    className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                      STATUS_STYLE[c.status] ?? 'bg-sg-neutral-100 text-sg-neutral-700'
                    }`}
                  >
                    {STATUS_LABEL[c.status] ?? c.status}
                  </span>
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
                      className="h-full bg-sg-accent-600"
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
