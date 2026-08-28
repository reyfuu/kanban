import Link from 'next/link'
import { requireUser } from '@/lib/session'
import { logout } from '@/lib/auth-actions'
import { NAV_ITEMS } from '@/components/nav-items'

/**
 * Application shell for every authenticated screen.
 *
 * Navigation is filtered by permission, but that filtering is cosmetic and is
 * not the control: FR-X-005 rule 3 is explicit that hiding a menu is not a
 * security measure, and the API refuses the request regardless of what the
 * sidebar showed. Filtering here only spares people links that would fail.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const visible = NAV_ITEMS.filter((item) => !item.permission || user.permissions.includes(item.permission))

  return (
    <div className="min-h-screen bg-sg-neutral-50">
      {/* Brand colour belongs on this bar (06-DESIGN Sec 2.0) once --tri-* is filled. */}
      <header className="border-b border-sg-neutral-200 bg-sg-neutral-900">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-semibold tracking-wide text-sg-neutral-0">
            SIGAP
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-sg-neutral-300">
              {user.full_name}
              <span className="ml-2 text-xs text-sg-neutral-400">{user.roles.join(' · ')}</span>
            </span>
            <form action={logout}>
              <button type="submit" className="text-sg-neutral-300 underline-offset-2 hover:underline">
                Keluar
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <nav aria-label="Navigasi utama" className="w-56 shrink-0">
          <ul className="space-y-1">
            {visible.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-sg-neutral-700 hover:bg-sg-neutral-100"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  )
}
