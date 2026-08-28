/**
 * Navigation, mapped to the screens in 05-UIUX-FLOW Sec 9.
 *
 * `permission` decides visibility only. The server enforces access; this list
 * exists so people are not shown doors that will not open.
 */
export interface NavItem {
  href: string
  label: string
  permission?: string
}

export const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Beranda' },
  { href: '/review', label: 'Review Saya', permission: 'review:read' },
  { href: '/kampanye', label: 'Kampanye', permission: 'campaign:read' },
  { href: '/tiket', label: 'Tiket Pencabutan', permission: 'ticket:read' },
  { href: '/aplikasi', label: 'Registri Aplikasi', permission: 'application:read' },
  { href: '/unggah-akses', label: 'Unggah Data Akses', permission: 'snapshot:upload' },
  { href: '/jejak-audit', label: 'Jejak Audit', permission: 'audit-log:verify' },
]
