import Link from 'next/link';
import { useRef } from 'react';
import { logout } from '../lib/auth-actions';
import { Icon } from './ui';

export const NAVIGATION = [
  { href: '/', label: 'Papan karakter', icon: 'board' },
  { href: '/routine', label: 'Rutinitas', icon: 'routine' },
  { href: '/farming', label: 'Jadwal farming', icon: 'calendar' },
  { href: '/gacha', label: 'Gacha planner', icon: 'gacha' },
  { href: '/settings', label: 'Pengaturan', icon: 'settings' },
] as const;

export function Header({ activePath, user }: { activePath: string; user: string | null }) {
  const drawer = useRef<HTMLDialogElement>(null);
  const navigation = <>
    <Link href="/" className="brand"><span className="brand-mark"><Icon name="board" /></span>HoyoKanban<span className="brand-dot" /></Link>
    <nav aria-label="Navigasi utama">{NAVIGATION.map(item => <Link key={item.href} href={item.href} className={`nav-link ${activePath === item.href ? 'is-active' : ''}`} aria-current={activePath === item.href ? 'page' : undefined} onClick={() => drawer.current?.close()}><Icon name={item.icon} />{item.label}</Link>)}</nav>
    <div className="sidebar-bottom">{user
      ? <><div className="local-status"><span />Tersinkron ke akun</div><div className="account-link"><span className="account-avatar"><Icon name="user" /></span><span>{user}<small><form action={logout}><button className="logout-button">Keluar</button></form></small></span></div></>
      : <><div className="local-status"><span />Tersimpan di perangkat ini</div><Link href="/login" className="account-link"><span className="account-avatar"><Icon name="user" /></span><span>Mode tamu<small>Masuk ke HoyoKanban</small></span><Icon name="arrow" size={16} /></Link></>}</div>
  </>;
  return <>
    <a className="skip-link" href="#main-content">Lewati navigasi</a>
    <aside className="sidebar">{navigation}</aside>
    <header className="mobile-header"><Link href="/" className="brand"><Icon name="board" />HoyoKanban</Link><button type="button" className="icon-button" aria-label="Buka navigasi" onClick={() => drawer.current?.showModal()}><Icon name="menu" /></button></header>
    <dialog ref={drawer} className="mobile-drawer" aria-label="Menu navigasi" onClick={event => { if (event.target === event.currentTarget) drawer.current?.close(); }}><div className="drawer-content"><button className="icon-button drawer-close" aria-label="Tutup navigasi" onClick={() => drawer.current?.close()}><Icon name="close" /></button>{navigation}</div></dialog>
  </>;
}
