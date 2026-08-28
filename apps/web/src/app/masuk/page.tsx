import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Masuk · SIGAP' }

export default async function MasukPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <main className="flex min-h-screen items-center justify-center bg-sg-neutral-100 p-6">
      <div className="w-full max-w-sm">
        {/* Brand chrome (06-DESIGN §2.0): the login screen carries the Trimegah
            navy mark now that the brand guideline has landed. Brand stays on
            chrome only, never in data areas. */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-tri-navy text-md font-bold tracking-tight text-tri-on-primary shadow-sm">
            SG
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-sg-neutral-900">SIGAP</h1>
          <p className="mt-1 text-sm text-sg-neutral-600">
            Sistem Integrasi Governance, Akses, dan Prosedur
          </p>
        </div>

        <div className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-6 shadow-md">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-sg-neutral-500">
          PT Trimegah Sekuritas Indonesia Tbk
        </p>
      </div>
    </main>
  )
}
