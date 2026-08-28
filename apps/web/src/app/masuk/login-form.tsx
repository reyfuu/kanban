'use client'

import { useActionState } from 'react'
import { login, type LoginState } from '@/lib/auth-actions'

const initialState: LoginState = { error: null }

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="username" className="block text-sm font-medium text-sg-neutral-700">
          Nama pengguna
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          autoFocus
          required
          className="mt-1 w-full rounded-md border border-sg-neutral-300 px-3 py-2 text-sm outline-none focus:border-sg-accent-600 focus:ring-2 focus:ring-sg-accent-100"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-sg-neutral-700">
          Kata sandi
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-1 w-full rounded-md border border-sg-neutral-300 px-3 py-2 text-sm outline-none focus:border-sg-accent-600 focus:ring-2 focus:ring-sg-accent-100"
        />
      </div>

      {state.error && (
        // role="alert" so a screen reader announces the failure instead of
        // leaving the user to discover it (06-DESIGN Sec 7, aksesibilitas).
        <p
          role="alert"
          className="rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700"
        >
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-sg-accent-600 px-3 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:opacity-60"
      >
        {pending ? 'Memeriksa…' : 'Masuk'}
      </button>
    </form>
  )
}
