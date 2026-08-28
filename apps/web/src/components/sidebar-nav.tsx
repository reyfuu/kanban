'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from './nav-items'

/**
 * The sidebar link list. A client component only so it can read the current
 * path and mark the active route -- the permission filtering that decides which
 * items exist happens on the server in the layout, where it belongs.
 *
 * The active state is a left accent rail plus a tinted surface, not the brand
 * colour: 06-DESIGN §2.0 reserves brand for chrome once --tri-* lands, and the
 * accent already carries "this is where you are" everywhere else in the app.
 */
export function SidebarNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname()

  // Preserve declaration order of both sections and items within them.
  const sections: { name: string; items: NavItem[] }[] = []
  for (const item of items) {
    let group = sections.find((s) => s.name === item.section)
    if (!group) {
      group = { name: item.section, items: [] }
      sections.push(group)
    }
    group.items.push(item)
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.name}>
          <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-wider text-sg-neutral-400">
            {section.name}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active =
                item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'flex items-center gap-2 rounded-md border-l-2 border-sg-accent-600 bg-sg-accent-50 py-2 pl-3 pr-3 text-sm font-medium text-sg-accent-700'
                        : 'flex items-center gap-2 rounded-md border-l-2 border-transparent py-2 pl-3 pr-3 text-sm text-sg-neutral-600 transition-colors hover:bg-sg-neutral-100 hover:text-sg-neutral-900'
                    }
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}
