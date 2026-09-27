'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { login, register } from '../lib/auth-actions';

export function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const registering = mode === 'register';
  const [state, action, pending] = useActionState(registering ? register : login, { error: null });
  return <form action={action} className="login-account-form">
    <label>Username<input name="username" defaultValue={state.username} autoComplete="username" required minLength={3} maxLength={30} pattern="[a-zA-Z0-9_]+" />
      {registering && <small className="field-hint">3–30 karakter: huruf kecil, angka, atau _.</small>}</label>
    <label>Kata sandi<input name="password" type="password" autoComplete={registering ? 'new-password' : 'current-password'} required minLength={8} maxLength={200} />
      {registering && <small className="field-hint">Minimal 8 karakter. Jangan pakai kata sandi HoYoverse.</small>}</label>
    {registering && <label>Ulangi kata sandi<input name="confirm" type="password" autoComplete="new-password" required minLength={8} maxLength={200} /></label>}
    {state.error && <p className="message error" role="alert">{state.error}</p>}
    <button className="button primary" disabled={pending}>{registering ? 'Buat akun' : 'Masuk'}</button>
    <p className="auth-switch">{registering ? <>Sudah punya akun? <Link href="/login">Masuk</Link></> : <>Belum punya akun? <Link href="/register">Daftar</Link></>}</p>
  </form>;
}
