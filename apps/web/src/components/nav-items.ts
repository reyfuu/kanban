import type { IconName } from './nav-icons'

/**
 * Navigation, mapped to the screens in 05-UIUX-FLOW Sec 9.
 *
 * `permission` decides visibility only. The server enforces access; this list
 * exists so people are not shown doors that will not open. `section` groups
 * links under a quiet heading in the sidebar so the three modules read as three
 * areas rather than one flat list. `icon` is a labelled line icon (§5: never
 * an icon without its label).
 */
export interface NavItem {
  href: string
  label: string
  permission?: string
  section: string
  icon: IconName
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda', section: 'Umum', icon: 'home' },
  { href: '/review', label: 'Review Saya', permission: 'review:read', section: 'Access Review', icon: 'clipboard-check' },
  { href: '/kampanye', label: 'Kampanye', permission: 'campaign:read', section: 'Access Review', icon: 'layers' },
  { href: '/tiket', label: 'Tiket Pencabutan', permission: 'ticket:read', section: 'Access Review', icon: 'ticket' },
  { href: '/aplikasi', label: 'Registri Aplikasi', permission: 'application:read', section: 'Access Review', icon: 'grid' },
  { href: '/unggah-akses', label: 'Unggah Data Akses', permission: 'snapshot:upload', section: 'Access Review', icon: 'upload' },
  { href: '/jejak-audit', label: 'Jejak Audit', permission: 'audit-log:verify', section: 'Sistem', icon: 'shield' },
]
