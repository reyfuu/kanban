import Link from 'next/link'
import { requireUser } from '@/lib/session'
import { logout } from '@/lib/auth-actions'
import { NAV_ITEMS } from '@/components/nav-items'
import { SidebarNav } from '@/components/sidebar-nav'

/**
 * Application shell for every authenticated screen.
 *
 * Navigation is filtered by permission, but that filtering is cosmetic and is
 * not the control: FR-X-005 rule 3 is explicit that hiding a menu is not a
 * security measure, and the API refuses the request regardless of what the
 * sidebar showed. Filtering here only spares people links that would fail.
 *
 * The sidebar and top bar are the "chrome" 06-DESIGN §2.0 / the brand guideline
 * reserve for brand colour. The vertical rail carries Trimegah navy with a thin
 * gold hairline; brand stays on chrome only and never enters the data areas, so
 * a status badge or risk marker keeps its semantic colour uncontested. The rail
 * is fixed and the header sticky so identity, sign-out and navigation stay put
 * through a four-hundred-row review.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const visible = NAV_ITEMS.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  )
  const initials = initialsOf(user.full_name)

  return (
    <div className="min-h-screen bg-sg-neutral-100">
      {/* Desktop rail — full-height brand chrome. */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-tri-navy md:flex">
        <div className="h-0.5 w-full bg-tri-gold" aria-hidden />

        <Link
          href="/"
          className="flex items-center gap-3 px-5 py-5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-gold"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-tri-on-primary text-sm font-bold tracking-tight text-tri-navy shadow-sm">
            SG
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-base font-semibold tracking-wide text-tri-on-primary">SIGAP</span>
            <span className="text-2xs font-medium tracking-wide text-tri-gold">
              PT Trimegah Sekuritas
            </span>
          </span>
        </Link>

        <div className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
          <SidebarNav items={visible} />
        </div>

        <div className="border-t border-white/10 p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tri-navy-dark text-2xs font-semibold text-tri-on-primary ring-1 ring-white/15"
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-tri-on-primary">
                {user.full_name}
              </span>
              <span className="block truncate text-2xs text-sg-neutral-400">
                {user.job_title ?? user.roles.join(' · ')}
              </span>
            </span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sg-neutral-300 transition-colors hover:bg-tri-navy-dark hover:text-tri-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-gold"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M15 17l5-5-5-5" />
                <path d="M20 12H9" />
                <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
              </svg>
              Keluar
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile top bar — same brand chrome, condensed. */}
      <header className="sticky top-0 z-30 border-b border-tri-navy-dark bg-tri-navy md:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-gold"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-tri-on-primary text-xs font-bold tracking-tight text-tri-navy">
              SG
            </span>
            <span className="text-sm font-semibold tracking-wide text-tri-on-primary">SIGAP</span>
          </Link>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="flex h-8 w-8 items-center justify-center rounded-full bg-tri-navy-dark text-2xs font-semibold text-tri-on-primary"
            >
              {initials}
            </span>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-sm text-sg-neutral-300 transition-colors hover:bg-tri-navy-dark hover:text-tri-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-gold"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Navigasi utama" className="overflow-x-auto border-t border-white/10 px-2 pb-2 pt-1">
          <SidebarNav items={visible} variant="rail" />
        </nav>
      </header>

      <div className="md:pl-64">
        <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}

/** Up to two initials for the avatar; a quiet identity cue, not a decoration. */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}
