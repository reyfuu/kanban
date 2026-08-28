import Link from 'next/link'
import { requireUser, hasPermission, type CurrentUser } from '@/lib/session'
import { apiFetch } from '@/lib/api'
import { formatNumber } from '@/lib/format'

/**
 * Beranda — the landing surface, and the reviewer's starting point for the day.
 *
 * It is deliberately a set of quiet summary cards, not a dashboard of charts:
 * 06-DESIGN §1.1 keeps the tool calm and reserves colour for meaning. Each card
 * counts one queue the signed-in person is accountable for and links straight
 * into it. Cards appear only when the person holds the permission the linked
 * screen needs -- the same permission the sidebar filters on -- so nobody lands
 * on a count they cannot act on.
 *
 * The counts are fetched per card and each failure is swallowed to a dash: a
 * summary tile is a convenience, and one slow queue must not blank the whole
 * landing page. The real screens behind them remain the source of truth.
 */
export default async function BerandaPage() {
  const user = await requireUser()
  const firstName = user.full_name.split(/\s+/)[0] ?? user.full_name

  const cards = await buildCards(user)

  return (
    <div>
      <header className="border-b border-sg-neutral-200 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-sg-neutral-900">
          Selamat datang, {firstName}.
        </h1>
        <span className="mt-2 block h-0.5 w-8 rounded-full bg-tri-navy" aria-hidden />
        <p className="mt-2 text-sm text-sg-neutral-600">
          Ringkasan tugas yang menunggu tindakan Anda. Angka diperbarui setiap kali halaman dibuka.
        </p>
      </header>

      {user.delegations_received.length > 0 && (
        // FR-X-007 rule 3: decisions made under delegation are recorded "on
        // behalf of", so the holder must know the delegation is active before
        // deciding anything -- not discover it later in the audit trail.
        <p className="mt-6 rounded-md border border-sg-info-500 bg-sg-info-50 px-3 py-2 text-sm text-sg-info-700">
          Anda memegang delegasi dari{' '}
          <span className="font-medium">
            {user.delegations_received.map((d) => d.from_user.full_name).join(', ')}
          </span>
          . Keputusan yang Anda ambil akan tercatat atas nama mereka.
        </p>
      )}

      {cards.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <SummaryCard key={card.href} {...card} />
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-sg-neutral-300 bg-sg-neutral-0 px-4 py-10 text-center text-sm text-sg-neutral-600">
          Tidak ada antrean tugas untuk peran Anda saat ini.
        </p>
      )}
    </div>
  )
}

interface Card {
  href: string
  label: string
  description: string
  count: number | null
  cta: string
  emphasis?: boolean
}

async function buildCards(user: CurrentUser): Promise<Card[]> {
  const cards: Card[] = []

  if (hasPermission(user, 'review:read')) {
    const items = await safeList<{ decision: unknown }>('/my/review-items?limit=500')
    const pending = items === null ? null : items.filter((i) => i.decision === null).length
    cards.push({
      href: '/review',
      label: 'Review Saya',
      description: 'Item hak akses yang menunggu keputusan Anda.',
      count: pending,
      cta: 'Buka daftar review',
      // Undecided review items are the one queue whose delay stalls a whole
      // campaign, so it is the one card allowed to draw the eye.
      emphasis: pending !== null && pending > 0,
    })
  }

  if (hasPermission(user, 'ticket:read')) {
    const tickets = await safeList<{ assignee: { id: string }; status: string }>(
      '/my/revocation-tickets',
    )
    const open =
      tickets === null
        ? null
        : tickets.filter((t) => t.status === 'TERBUKA' || t.status === 'DALAM_PROSES').length
    cards.push({
      href: '/tiket',
      label: 'Tiket Pencabutan',
      description: 'Tiket pencabutan yang ditugaskan kepada Anda dan masih terbuka.',
      count: open,
      cta: 'Buka tiket saya',
    })
  }

  if (hasPermission(user, 'campaign:read')) {
    const campaigns = await safeList<{ status: string }>('/campaigns')
    const active =
      campaigns === null
        ? null
        : campaigns.filter((c) =>
            ['BERJALAN', 'DIPERPANJANG', 'MENUNGGU_SIGNOFF'].includes(c.status),
          ).length
    cards.push({
      href: '/kampanye',
      label: 'Kampanye Berjalan',
      description: 'Kampanye review yang sedang berlangsung dalam cakupan Anda.',
      count: active,
      cta: 'Buka kampanye',
    })
  }

  return cards
}

/** A list fetch that degrades to null rather than throwing the page down. */
async function safeList<T>(path: string): Promise<T[] | null> {
  try {
    return await apiFetch<T[]>(path)
  } catch {
    return null
  }
}

function SummaryCard(props: Card) {
  return (
    <Link
      href={props.href}
      className={`group relative block overflow-hidden rounded-xl border bg-sg-neutral-0 p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600 ${
        props.emphasis
          ? 'border-sg-accent-300 hover:border-sg-accent-500'
          : 'border-sg-neutral-200 hover:border-sg-neutral-300'
      }`}
    >
      <span
        aria-hidden
        className={`absolute inset-x-0 top-0 h-0.5 ${
          props.emphasis ? 'bg-sg-accent-600' : 'bg-tri-navy'
        }`}
      />
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-md font-semibold text-sg-neutral-900">{props.label}</h2>
        <span
          className={`text-3xl font-semibold tabular-nums ${
            props.emphasis ? 'text-sg-accent-700' : 'text-sg-neutral-900'
          }`}
        >
          {props.count === null ? '—' : formatNumber(props.count)}
        </span>
      </div>
      <p className="mt-1.5 text-sm text-sg-neutral-600">{props.description}</p>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-sg-accent-700">
        {props.cta}
        <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
          →
        </span>
      </span>
    </Link>
  )
}
