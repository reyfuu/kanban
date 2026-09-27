import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/session'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Masuk · SIGAP' }

export default async function MasukPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (login is chrome per the brand guideline): full Trimegah
          navy with a gold hairline and wealth-gold accents. Brand stays on
          chrome only, never in data areas. */}
      <section className="relative hidden flex-col justify-between overflow-hidden bg-tri-navy p-12 lg:flex">
        <div className="absolute inset-x-0 top-0 h-1 bg-tri-gold" aria-hidden />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-tri-navy-dark opacity-60 blur-2xl"
        />
        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-tri-on-primary text-md font-bold tracking-tight text-tri-navy shadow-sm">
            SG
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-wide text-tri-on-primary">SIGAP</span>
            <span className="text-xs font-medium tracking-wide text-tri-gold">
              PT Trimegah Sekuritas Indonesia Tbk
            </span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-2xl font-semibold leading-snug tracking-tight text-tri-on-primary">
            Sistem Integrasi Governance, Akses, dan Prosedur
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-sg-neutral-300">
            Tata kelola bukti audit, review hak akses lintas aplikasi, dan prosedur operasi
            standar dalam satu platform terpercaya.
          </p>
          <div className="mt-6 h-px w-16 bg-tri-gold" aria-hidden />
        </div>

        <p className="relative text-xs tracking-wide text-sg-neutral-400">
          Integritas · Profesionalisme · Keandalan · Inovasi
        </p>
      </section>

      {/* Form panel — neutral surface, calm. */}
      <section className="flex items-center justify-center bg-sg-neutral-100 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-tri-navy text-md font-bold tracking-tight text-tri-on-primary shadow-sm">
              SG
            </span>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-sg-neutral-900">SIGAP</h1>
            <p className="mt-1 text-sm text-sg-neutral-600">
              Sistem Integrasi Governance, Akses, dan Prosedur
            </p>
          </div>

          <div className="mb-6 hidden lg:block">
            <h1 className="text-xl font-semibold tracking-tight text-sg-neutral-900">Masuk</h1>
            <p className="mt-1 text-sm text-sg-neutral-600">
              Gunakan kredensial korporat Anda untuk melanjutkan.
            </p>
          </div>

          <div className="rounded-xl border border-sg-neutral-200 bg-sg-neutral-0 p-6 shadow-sm">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-sg-neutral-500">
            PT Trimegah Sekuritas Indonesia Tbk
          </p>
        </div>
      </section>
    </main>
  )
}
