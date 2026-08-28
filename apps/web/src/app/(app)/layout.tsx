import { requireUser } from '@/lib/session'
import { logout } from '@/lib/auth-actions'
import { NAV_ITEMS } from '@/components/nav-items'
import { AppSidebar } from '@/components/app-sidebar'

/**
 * Application shell for every authenticated screen.
 *
 * Navigation is filtered by permission, but that filtering is cosmetic and is
 * not the control: FR-X-005 rule 3 is explicit that hiding a menu is not a
 * security measure, and the API refuses the request regardless of what the
 * sidebar showed. Filtering here only spares people links that would fail.
 *
 * Navigation is sidebar-only. The sidebar is the "chrome" the brand guideline
 * reserves for brand colour: full-height Trimegah navy with a gold hairline.
 * On desktop it is fixed; on a narrow screen it collapses behind a single menu
 * button and slides over. Brand stays on chrome only and never enters the data
 * areas, so a status badge or risk marker keeps its semantic colour uncontested.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser()
  const visible = NAV_ITEMS.filter(
    (item) => !item.permission || user.permissions.includes(item.permission),
  )

  return (
    <div className="min-h-screen bg-sg-neutral-100">
      <AppSidebar
        items={visible}
        userName={user.full_name}
        userSubtitle={user.job_title ?? user.roles.join(' · ')}
        logout={logout}
      />

      <div className="md:pl-64">
        <main className="mx-auto min-w-0 max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  )
}
