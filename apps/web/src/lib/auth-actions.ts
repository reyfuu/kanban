'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiFetch, ApiError, SESSION_COOKIE } from './api'

export interface LoginState {
  error: string | null
}

interface LoginResponse {
  access_token: string
  expires_in: number
}

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get('username') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!username || !password) {
    return { error: 'Nama pengguna dan kata sandi wajib diisi.' }
  }

  let result: LoginResponse
  try {
    result = await apiFetch<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
      anonymous: true,
    })
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Passed through verbatim from the API, which deliberately gives the same
      // message for a wrong password and an unknown account (FR-X-001).
      // Rewording it per-case here would rebuild the account oracle the API
      // just closed.
      return { error: error.message }
    }
    return { error: 'Sistem tidak dapat dihubungi. Coba beberapa saat lagi.' }
  }

  const store = await cookies()
  store.set(SESSION_COOKIE, result.access_token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    // Matches the session's idle window. The API is the authority on expiry;
    // this only stops the browser from sending a token that is already dead.
    maxAge: result.expires_in,
  })

  redirect('/')
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST' })
  } catch {
    // The cookie is cleared regardless. A user who asked to sign out must end up
    // signed out even if the API call fails; the server-side session will lapse
    // on its own timers.
  }
  ;(await cookies()).delete(SESSION_COOKIE)
  redirect('/masuk')
}
