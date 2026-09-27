'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { hashPassword, SESSION_COOKIE, signSession, validPassword, validUsername, verifyPassword } from './auth';
import { redis } from './redis';

export interface AuthState { error: string | null; username?: string }

async function startSession(username: string) {
  const maxAge = 30 * 86400;
  (await cookies()).set(SESSION_COOKIE, signSession(username, Date.now() + maxAge * 1000), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge,
  });
}

function credentials(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const fail = (error: string): AuthState => ({ error, username });
  const error = !validUsername(username) ? fail('Username 3–30 karakter: huruf kecil, angka, atau _.')
    : !validPassword(password) ? fail('Kata sandi minimal 8 karakter.') : null;
  return { username, password, fail, error };
}

const OFFLINE = 'Server akun belum dapat dihubungi. Coba beberapa saat lagi.';

export async function login(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { username, password, fail, error } = credentials(formData);
  if (error) return error;
  try {
    const attempts = await redis<number>('INCR', `rl:${username}`);
    if (attempts === 1) await redis('EXPIRE', `rl:${username}`, 900);
    if (attempts > 10) return fail('Terlalu banyak percobaan. Coba lagi 15 menit lagi.');
    const stored = await redis<string | null>('GET', `user:${username}`);
    if (!stored || !verifyPassword(password, stored)) return fail('Username atau kata sandi salah.');
    await redis('DEL', `rl:${username}`);
    await startSession(username);
  } catch (reason) { console.error(reason); return fail(reason instanceof Error && reason.cause === 'config' ? reason.message : OFFLINE); }
  redirect('/');
}

export async function register(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { username, password, fail, error } = credentials(formData);
  if (error) return error;
  if (password !== formData.get('confirm')) return fail('Konfirmasi kata sandi tidak sama.');
  try {
    if (await redis('SET', `user:${username}`, hashPassword(password), 'NX') !== 'OK') return fail('Username sudah dipakai.');
    await startSession(username);
  } catch (reason) { console.error(reason); return fail(reason instanceof Error && reason.cause === 'config' ? reason.message : OFFLINE); }
  redirect('/');
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
