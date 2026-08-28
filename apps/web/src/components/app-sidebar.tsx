'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { NavItem } from './nav-items'
import { NavIcon } from './nav-icons'

/**
 * The single navigation surface for the app: a full-height Trimegah navy
 * sidebar. On desktop it is fixed; on a narrow screen it collapses behind one
 * menu button and slides over a scrim. It is a client component so it can read
 * the active route and own the open/closed state -- the permission filtering
 * that decides which items exist still happens on the server, in the layout.
 *
 * `logout` is the server action passed down from the layout so the sign-out
 * button stays a real form submission.
 */
export function AppSidebar({
  items,
  userName,
  userSubtitle,
  logout,
}: {
  items: NavItem[]
  userName: string
  userSubtitle: string
  logout: () => void
}) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLElement>(null)
  const pathname = usePathname()

  /*
   * While the mobile slide-over is open it is a modal surface, so it has to
   * behave like one: Escape closes it, focus moves into it, and Tab cycles
   * inside it. Without this the keyboard focus stays on the page behind an
   * opaque overlay -- the user tabs through controls they cannot see and
   * cannot tell where they are. The listener is removed when it closes, and
   * on desktop (where the sidebar is permanent) it never runs at all.
   */
  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    panel?.querySelector<HTMLElement>('a, button')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !panel) return

      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (!first || !last) return

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])
  const initials = initialsOf(userName)

  const isActive = (item: NavItem) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

  // Group items by section, preserving declaration order.
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
    <>
      {/* Mobile: a slim bar carrying only the menu button and mark. */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-tri-navy-dark bg-tri-navy px-4 py-2.5 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buka navigasi"
          className="flex h-11 w-11 items-center justify-center rounded-md text-tri-on-primary hover:bg-tri-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-gold"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-tri-on-primary text-xs font-bold tracking-tight text-tri-navy">
            SG
          </span>
          <span className="text-sm font-semibold tracking-wide text-tri-on-primary">SIGAP</span>
        </span>
      </div>

      {/* Scrim for the mobile slide-over. */}
      {open && (
        /* A click-catcher, not a control: aria-hidden and out of the tab order
           because the panel already offers a real "Tutup navigasi" button and
           Escape. A full-screen <button> would otherwise be one more tab stop
           between the user and the navigation. */
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-tri-navy-dark/60 md:hidden"
        />
      )}

      <aside
        ref={panelRef}
        aria-modal={open ? true : undefined}
        role={open ? 'dialog' : undefined}
        aria-label="Navigasi utama"
        className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-tri-navy transition-transform duration-200 md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-0.5 w-full bg-tri-gold" aria-hidden />

        <div className="flex items-center justify-between px-5 py-4">
          <Link
            href="/"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-gold"
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
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Tutup navigasi"
            className="flex h-11 w-11 items-center justify-center rounded-md text-sg-neutral-300 hover:bg-tri-navy-dark hover:text-tri-on-primary md:hidden"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <nav aria-label="Navigasi utama" className="sigap-sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
          <div className="space-y-4">
            {sections.map((section) => (
              <div key={section.name}>
                <p className="px-3 pb-1.5 text-2xs font-semibold uppercase tracking-widest text-sg-neutral-400">
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
                          onClick={() => setOpen(false)}
                          className={
                            active
                              ? 'relative flex min-h-11 items-center gap-3 rounded-lg bg-tri-navy-hover py-2 pl-3 pr-3 text-sm font-medium text-tri-on-primary'
                              : 'relative flex min-h-11 items-center gap-3 rounded-lg py-2 pl-3 pr-3 text-sm text-sg-neutral-300 transition-colors hover:bg-tri-navy-hover hover:text-tri-on-primary'
                          }
                        >
                          {active && (
                            <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-tri-gold" />
                          )}
                          <NavIcon name={item.icon} className={active ? 'text-tri-gold' : 'text-sg-neutral-400'} />
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        <div className="border-t border-tri-navy-line p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <span
              aria-hidden
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-tri-navy-dark text-2xs font-semibold text-tri-on-primary ring-1 ring-tri-navy-line"
            >
              {initials}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-tri-on-primary">{userName}</span>
              <span className="block truncate text-2xs text-sg-neutral-400">{userSubtitle}</span>
            </span>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-sg-neutral-300 transition-colors hover:bg-tri-navy-dark hover:text-tri-on-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-gold"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M15 17l5-5-5-5" />
                <path d="M20 12H9" />
                <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
              </svg>
              Keluar
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}

/** Up to two initials for the avatar; a quiet identity cue, not a decoration. */
function initialsOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}
