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
 * The header and sidebar are the "chrome" 06-DESIGN §2.0 reserves for brand
 * colour once --tri-* lands. Until then they stay neutral -- a dark top bar and
 * a quiet rail -- because guessing the corporate navy from a screenshot is
 * worse than plain. Both are sticky so the identity, the sign-out and the
 * navigation stay put through a four-hundred-row review.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const visible = NAV_ITEMS.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  )
  const initials = initialsOf(user.full_name)

  return (
    <div className="min-h-screen bg-sg-neutral-50">
      <header className="sticky top-0 z-30 border-b border-sg-neutral-800 bg-sg-neutral-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link
            href="/"
            className="flex items-center gap-2.5 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-500"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-sg-neutral-0 text-xs font-bold tracking-tight text-sg-neutral-900">
              SG
            </span>
            <span className="text-sm font-semibold tracking-wide text-sg-neutral-0">SIGAP</span>
          </Link>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="flex h-8 w-8 items-center justify-center rounded-full bg-sg-neutral-700 text-2xs font-semibold text-sg-neutral-100"
              >
                {initials}
              </span>
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-sm font-medium text-sg-neutral-0">{user.full_name}</span>
                <span className="block text-2xs text-sg-neutral-400">{user.roles.join(' · ')}</span>
              </span>
            </div>
            <form action={logout}>
              <button
                type="submit"
                className="rounded-md px-2.5 py-1.5 text-sm text-sg-neutral-300 transition-colors hover:bg-sg-neutral-800 hover:text-sg-neutral-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-500"
              >
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-8">
        <nav
          aria-label="Navigasi utama"
          className="sticky top-[4.25rem] hidden h-fit w-56 shrink-0 md:block"
        >
          <SidebarNav items={visible} />
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
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
