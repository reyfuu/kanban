'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from './nav-items'
import { NavIcon } from './nav-icons'

/**
 * The sidebar link list. A client component only so it can read the current
 * path and mark the active route -- the permission filtering that decides which
 * items exist happens on the server in the layout, where it belongs.
 *
 * The rail lives inside brand chrome (Trimegah navy), so the active state is a
 * white/gold treatment on a translucent surface rather than the app accent: the
 * brand guideline reserves brand colour for chrome, and the gold rail carries
 * "this is where you are" against the navy. `variant="rail"` renders the flat,
 * horizontal list used inside the condensed mobile top bar.
 */
export function SidebarNav({
  items,
  variant = 'stack',
}: {
  items: NavItem[]
  variant?: 'stack' | 'rail'
}) {
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

  const isActive = (item: NavItem) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

  if (variant === 'rail') {
    return (
      <ul className="flex items-center gap-1">
        {items.map((item) => {
          const active = isActive(item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'flex items-center gap-2 whitespace-nowrap rounded-md bg-white/15 px-3 py-1.5 text-sm font-medium text-tri-on-primary'
                    : 'flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm text-sg-neutral-300 transition-colors hover:bg-white/10 hover:text-tri-on-primary'
                }
              >
                <NavIcon name={item.icon} className={active ? 'text-tri-gold' : 'text-sg-neutral-400'} />
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="space-y-6">
      {sections.map((section) => (
        <div key={section.name}>
          <p className="px-3 pb-2 text-2xs font-semibold uppercase tracking-widest text-sg-neutral-400">
            {section.name}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const active = isActive(item)
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={
                      active
                        ? 'relative flex items-center gap-3 rounded-lg bg-white/10 py-2 pl-3 pr-3 text-sm font-medium text-tri-on-primary'
                        : 'relative flex items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm text-sg-neutral-300 transition-colors hover:bg-white/5 hover:text-tri-on-primary'
                    }
                  >
                    {active && (
                      <span
                        aria-hidden
                        className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-tri-gold"
                      />
                    )}
                    <NavIcon
                      name={item.icon}
                      className={active ? 'text-tri-gold' : 'text-sg-neutral-400'}
                    />
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
