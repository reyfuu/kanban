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
        {/* Brand chrome belongs here per 06-DESIGN Sec 2.0, but --tri-* values are
            deliberately empty until the brand guideline arrives. Neutral until then;
            guessing the corporate navy from a screenshot is worse than plain. */}
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-sg-neutral-900 text-md font-bold tracking-tight text-sg-neutral-0 shadow-sm">
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
