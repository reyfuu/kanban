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
          className="mt-1.5 w-full rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2.5 text-sm outline-none transition-colors focus:border-tri-navy focus:ring-2 focus:ring-tri-navy/15"
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
          className="mt-1.5 w-full rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2.5 text-sm outline-none transition-colors focus:border-tri-navy focus:ring-2 focus:ring-tri-navy/15"
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
        className="w-full rounded-lg bg-tri-navy px-3 py-2.5 text-sm font-semibold text-tri-on-primary shadow-sm transition-colors hover:bg-tri-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-navy disabled:opacity-60"
      >
        {pending ? 'Memeriksa…' : 'Masuk'}
      </button>
    </form>
  )
}
