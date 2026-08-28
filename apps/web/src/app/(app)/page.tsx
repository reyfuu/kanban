import Link from 'next/link'
import { requireUser, hasPermission } from '@/lib/session'
import { apiFetch } from '@/lib/api'
import { formatNumber } from '@/lib/format'
import { NavIcon, type IconName } from '@/components/nav-icons'

/**
 * Beranda — the landing surface, and the reviewer's starting point for the day.
 *
 * A compact visual dashboard rather than a wall of prose: 06-DESIGN §1.1 keeps
 * the tool calm and reserves colour for meaning, so the metrics here lean on
 * shape (rings, bars, tiles) and numbers, with as little text as the meaning
 * allows. Every tile counts a queue the signed-in person is accountable for and
 * links straight into it, and appears only when they hold the permission the
 * linked screen needs.
 *
 * Counts are fetched per section and each failure degrades to a dash: a summary
 * is a convenience, and one slow queue must not blank the landing page. The real
 * screens behind them remain the source of truth.
 */
export default async function BerandaPage() {
  const user = await requireUser()
  const firstName = user.full_name.split(/\s+/)[0] ?? user.full_name

  const [review, tickets, campaigns] = await Promise.all([
    hasPermission(user, 'review:read') ? loadReview() : Promise.resolve(null),
    hasPermission(user, 'ticket:read') ? loadTickets() : Promise.resolve(null),
    hasPermission(user, 'campaign:read') ? loadCampaigns() : Promise.resolve(null),
  ])

  const stats = buildStats(review, tickets, campaigns)
  const hasAny = review !== null || tickets !== null || campaigns !== null

  return (
    <div className="space-y-8">
      <header className="border-b border-sg-neutral-200 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-sg-neutral-900">
          Selamat datang, {firstName}.
        </h1>
        <span className="mt-2 block h-0.5 w-8 rounded-full bg-tri-navy" aria-hidden />
      </header>

      {user.delegations_received.length > 0 && (
        <p className="rounded-lg border border-sg-info-500 bg-sg-info-50 px-3 py-2 text-sm text-sg-info-700">
          Delegasi aktif dari{' '}
          <span className="font-medium">
            {user.delegations_received.map((d) => d.from_user.full_name).join(', ')}
          </span>
          .
        </p>
      )}

      {!hasAny && (
        <p className="rounded-lg border border-dashed border-sg-neutral-300 bg-sg-neutral-0 px-4 py-10 text-center text-sm text-sg-neutral-600">
          Tidak ada antrean tugas untuk peran Anda saat ini.
        </p>
      )}

      {/* Stat tiles — one number each, no prose. */}
      {stats.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {stats.map((s) => (
            <StatTile key={s.label} {...s} />
          ))}
        </div>
      )}

      {/* Visual panels. */}
      <div className="grid gap-4 lg:grid-cols-3">
        {review && (
          <ReviewPanel decided={review.decided} pending={review.pending} total={review.total} />
        )}
        {tickets && <TicketPanel data={tickets} />}
        {campaigns && <CampaignPanel data={campaigns} />}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ data --- */

interface ReviewData {
  total: number
  pending: number
  decided: number
}
interface TicketData {
  open: number
  inProgress: number
  closed: number
  total: number
}
interface CampaignData {
  active: number
  signoff: number
  done: number
  total: number
}

async function loadReview(): Promise<ReviewData | null> {
  const items = await safeList<{ decision: unknown }>('/my/review-items?limit=500')
  if (items === null) return null
  const pending = items.filter((i) => i.decision === null).length
  return { total: items.length, pending, decided: items.length - pending }
}

async function loadTickets(): Promise<TicketData | null> {
  const rows = await safeList<{ status: string }>('/my/revocation-tickets')
  if (rows === null) return null
  const open = rows.filter((t) => t.status === 'TERBUKA').length
  const inProgress = rows.filter((t) => t.status === 'DALAM_PROSES').length
  const closed = rows.filter((t) => t.status !== 'TERBUKA' && t.status !== 'DALAM_PROSES').length
  return { open, inProgress, closed, total: rows.length }
}

async function loadCampaigns(): Promise<CampaignData | null> {
  const rows = await safeList<{ status: string }>('/campaigns')
  if (rows === null) return null
  const active = rows.filter((c) => ['BERJALAN', 'DIPERPANJANG'].includes(c.status)).length
  const signoff = rows.filter((c) => c.status === 'MENUNGGU_SIGNOFF').length
  const done = rows.filter((c) => ['SELESAI', 'DITUTUP'].includes(c.status)).length
  return { active, signoff, done, total: rows.length }
}

/** A list fetch that degrades to null rather than throwing the page down. */
async function safeList<T>(path: string): Promise<T[] | null> {
  try {
    return await apiFetch<T[]>(path)
  } catch {
    return null
  }
}

interface Stat {
  label: string
  value: number | null
  href: string
  icon: IconName
  emphasis?: boolean
}

function buildStats(
  review: ReviewData | null,
  tickets: TicketData | null,
  campaigns: CampaignData | null,
): Stat[] {
  const stats: Stat[] = []
  if (review) {
    stats.push({
      label: 'Review tertunda',
      value: review.pending,
      href: '/review',
      icon: 'clipboard-check',
      emphasis: review.pending > 0,
    })
  }
  if (tickets) {
    stats.push({
      label: 'Tiket terbuka',
      value: tickets.open + tickets.inProgress,
      href: '/tiket',
      icon: 'ticket',
      emphasis: tickets.open + tickets.inProgress > 0,
    })
  }
  if (campaigns) {
    stats.push({
      label: 'Kampanye aktif',
      value: campaigns.active,
      href: '/kampanye',
      icon: 'layers',
    })
    stats.push({
      label: 'Menunggu sign-off',
      value: campaigns.signoff,
      href: '/kampanye',
      icon: 'shield',
      emphasis: campaigns.signoff > 0,
    })
  }
  return stats
}

/* -------------------------------------------------------------- visuals --- */

function StatTile(props: Stat) {
  return (
    <Link
      href={props.href}
      className={`group relative overflow-hidden rounded-xl border bg-sg-neutral-0 p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600 ${
        props.emphasis ? 'border-sg-accent-300' : 'border-sg-neutral-200'
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-0.5 ${props.emphasis ? 'bg-sg-accent-600' : 'bg-tri-navy'}`}
      />
      <div className="flex items-center justify-between">
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-lg ${
            props.emphasis ? 'bg-sg-accent-50 text-sg-accent-700' : 'bg-sg-neutral-100 text-sg-neutral-500'
          }`}
        >
          <NavIcon name={props.icon} />
        </span>
        <span
          className={`text-3xl font-semibold tabular-nums ${
            props.emphasis ? 'text-sg-accent-700' : 'text-sg-neutral-900'
          }`}
        >
          {props.value === null ? '—' : formatNumber(props.value)}
        </span>
      </div>
      <p className="mt-2 text-2xs font-medium uppercase tracking-wide text-sg-neutral-500">
        {props.label}
      </p>
    </Link>
  )
}

/** A thin donut ring drawn with a conic-gradient — decided vs pending. */
function ReviewPanel(props: { decided: number; pending: number; total: number }) {
  const pct = props.total === 0 ? 0 : Math.round((props.decided / props.total) * 100)
  return (
    <Panel href="/review" title="Progres review" cta="Buka daftar review">
      <div className="flex items-center gap-4">
        <div
          className="relative h-24 w-24 shrink-0 rounded-full"
          style={{
            background: `conic-gradient(var(--color-sg-accent-600) ${pct * 3.6}deg, var(--color-sg-neutral-200) 0deg)`,
          }}
          role="img"
          aria-label={`${pct}% selesai`}
        >
          <div className="absolute inset-2 flex flex-col items-center justify-center rounded-full bg-sg-neutral-0">
            <span className="text-lg font-semibold tabular-nums text-sg-neutral-900">{pct}%</span>
          </div>
        </div>
        <dl className="space-y-1.5 text-sm">
          <Legend swatch="bg-sg-accent-600" label="Diputuskan" value={props.decided} />
          <Legend swatch="bg-sg-neutral-200" label="Tertunda" value={props.pending} />
          <Legend swatch="bg-transparent" label="Total" value={props.total} muted />
        </dl>
      </div>
    </Panel>
  )
}

function TicketPanel(props: { data: TicketData }) {
  const { open, inProgress, closed, total } = props.data
  const max = Math.max(open, inProgress, closed, 1)
  return (
    <Panel href="/tiket" title="Tiket pencabutan" cta="Buka tiket saya">
      <div className="space-y-3">
        <Bar label="Terbuka" value={open} max={max} tone="bg-sg-warning-500" />
        <Bar label="Dalam proses" value={inProgress} max={max} tone="bg-sg-info-500" />
        <Bar label="Selesai" value={closed} max={max} tone="bg-sg-success-500" />
      </div>
      <p className="mt-3 text-2xs uppercase tracking-wide text-sg-neutral-500">
        {formatNumber(total)} total
      </p>
    </Panel>
  )
}

function CampaignPanel(props: { data: CampaignData }) {
  const { active, signoff, done, total } = props.data
  const max = Math.max(active, signoff, done, 1)
  return (
    <Panel href="/kampanye" title="Kampanye" cta="Buka kampanye">
      <div className="space-y-3">
        <Bar label="Berjalan" value={active} max={max} tone="bg-sg-accent-600" />
        <Bar label="Menunggu sign-off" value={signoff} max={max} tone="bg-sg-warning-500" />
        <Bar label="Selesai" value={done} max={max} tone="bg-sg-success-500" />
      </div>
      <p className="mt-3 text-2xs uppercase tracking-wide text-sg-neutral-500">
        {formatNumber(total)} total
      </p>
    </Panel>
  )
}

function Panel(props: { href: string; title: string; cta: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-xl border border-sg-neutral-200 bg-sg-neutral-0 p-5 shadow-sm">
      <h2 className="text-md font-semibold text-sg-neutral-900">{props.title}</h2>
      <div className="mt-4 flex-1">{props.children}</div>
      <Link
        href={props.href}
        className="group mt-4 inline-flex items-center gap-1 text-sm font-medium text-sg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600"
      >
        {props.cta}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </Link>
    </div>
  )
}

function Bar(props: { label: string; value: number; max: number; tone: string }) {
  const w = props.max === 0 ? 0 : Math.round((props.value / props.max) * 100)
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-sg-neutral-700">{props.label}</span>
        <span className="font-semibold tabular-nums text-sg-neutral-900">
          {formatNumber(props.value)}
        </span>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-sg-neutral-100">
        <div className={`h-full rounded-full ${props.tone}`} style={{ width: `${w}%` }} />
      </div>
    </div>
  )
}

function Legend(props: { swatch: string; label: string; value: number; muted?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className={`h-2.5 w-2.5 rounded-sm ${props.swatch}`} aria-hidden />
      <dt className={props.muted ? 'text-sg-neutral-500' : 'text-sg-neutral-700'}>{props.label}</dt>
      <dd className="ml-auto font-semibold tabular-nums text-sg-neutral-900">
        {formatNumber(props.value)}
      </dd>
    </div>
  )
}
