import Link from 'next/link';
import { AuthForm } from './AuthForm';
import { Icon } from './ui';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  return <main className="login-page"><section className="login-story"><Link href="/" className="brand"><span className="brand-mark"><Icon name="board" /></span>HoyoKanban<span className="brand-dot" /></Link>
    <div className="login-intro"><h1>Build lebih terarah.<br /><span>Main lebih tenang.</span></h1><p>Ruang kecil untuk rencana besarmu di Teyvat dan New Eridu.</p>
      <div className="login-preview" aria-label="Contoh alur papan karakter"><div><span className="stage-dot stage-backlog" /><span>Rencanakan</span><small>Pilih karakter berikutnya</small></div><div><span className="stage-dot stage-leveling" /><span>Kerjakan</span><small>Satu target setiap hari</small></div><div><span className="stage-dot stage-ready" /><span>Nikmati</span><small>Tim siap dimainkan</small></div></div>
    </div><p className="login-story-footer">Genshin Impact / Zenless Zone Zero</p>
  </section><section className="login-form-section"><div className="login-form"><span className="login-symbol"><Icon name="board" size={28} /></span>{mode === 'register' ? <><h2>Buat akun.</h2><p>Simpan papanmu online<br />dan buka dari perangkat mana saja.</p></> : <><h2>Selamat datang.</h2><p>Mulai dari satu karakter.<br />Bangun tim dengan ritmemu sendiri.</p></>}
    <AuthForm mode={mode} />
    <Link href="/" className="button secondary login-cta">Lanjut sebagai tamu<Icon name="arrow" size={18} /></Link>
    <p className="login-note">Tanpa akun, progres tersimpan di perangkat ini saja.</p>
    <Link href="/settings" className="text-link">Sudah punya backup? Pulihkan papanmu</Link>
  </div><p className="login-disclaimer">HoyoKanban adalah proyek komunitas, bukan produk resmi HoYoverse.</p></section></main>;
}
