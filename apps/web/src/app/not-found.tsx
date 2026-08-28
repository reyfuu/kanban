import type { Metadata } from 'next'
import Link from 'next/link'

/**
 * The root 404, for addresses outside the authenticated shell.
 *
 * The in-app version at `(app)/not-found.tsx` is the one people normally see.
 * This one exists so an unauthenticated or malformed URL does not fall through
 * to Next's built-in English screen, including its `<title>` -- which the
 * segment-level not-found cannot override.
 */
export const metadata: Metadata = {
  title: '404 · Halaman tidak ditemukan — SIGAP',
}

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-24 text-center">
      <p className="text-2xs font-semibold uppercase tracking-widest text-sg-neutral-500">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-sg-neutral-900">
        Halaman tidak ditemukan
      </h1>
      <span className="mx-auto mt-3 block h-0.5 w-8 rounded-full bg-tri-navy" aria-hidden />
      <p className="mt-3 text-sm text-sg-neutral-600">
        Alamat yang Anda tuju tidak ada, atau objeknya tidak tersedia bagi akun Anda.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-tri-navy px-5 text-sm font-semibold text-tri-on-primary transition-colors hover:bg-tri-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-navy"
      >
        Kembali ke beranda
      </Link>
    </div>
  )
}
