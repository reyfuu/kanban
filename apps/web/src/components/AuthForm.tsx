'use client';

import Link from 'next/link';
import { useActionState, useState } from 'react';
import { login, register } from '../lib/auth-actions';
import { Icon } from './ui';

function PasswordField({ label, name, autoComplete, hint }: { label: string; name: string; autoComplete: string; hint?: string | undefined }) {
  const [shown, setShown] = useState(false);
  return <label>{label}
    <span className="password-field">
      <input name={name} type={shown ? 'text' : 'password'} autoComplete={autoComplete} required minLength={8} maxLength={200} />
      <button type="button" className="icon-button" aria-pressed={shown} aria-label={shown ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'} onClick={() => setShown(!shown)}><Icon name={shown ? 'eyeOff' : 'eye'} size={18} /></button>
    </span>
    {hint && <small className="field-hint">{hint}</small>}
  </label>;
}

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const registering = mode === 'register';
  const [state, action, pending] = useActionState(registering ? register : login, { error: null });
  return <form action={action} className="login-account-form">
    <label>Username<input name="username" defaultValue={state.username} autoComplete="username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" />
      {registering && <small className="field-hint">3–30 karakter: huruf kecil, angka, atau _.</small>}</label>
    <PasswordField label="Kata sandi" name="password" autoComplete={registering ? 'new-password' : 'current-password'}
      hint={registering ? 'Minimal 8 karakter. Jangan pakai kata sandi HoYoverse.' : undefined} />
    {registering && <PasswordField label="Ulangi kata sandi" name="confirm" autoComplete="new-password" />}
    {state.error && <p className="message error" role="alert">{state.error}</p>}
    <button className="button primary" disabled={pending}>{registering ? 'Buat akun' : 'Masuk'}</button>
    <p className="auth-switch">{registering ? <>Sudah punya akun? <Link href="/login">Masuk</Link></> : <>Belum punya akun? <Link href="/register">Daftar</Link></>}</p>
  </form>;
}
