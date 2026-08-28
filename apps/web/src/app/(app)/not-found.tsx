import Link from 'next/link'

/**
 * The 404 surface, in Bahasa Indonesia.
 *
 * It exists because `notFound()` is load-bearing in this application rather
 * than decorative: kode aturan #3 returns 404 instead of 403 for objects whose
 * existence is itself confidential, so this page is what a person sees when
 * they ask for a Rahasia document they may not access. Next's default English
 * screen would both break the interface language and read as a system error
 * rather than a normal, correct answer.
 *
 * The wording is deliberately identical for "does not exist" and "you may not
 * see it". Any difference between the two, however small, is the disclosure the
 * 404 exists to prevent.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-widest text-sg-neutral-500">404</p>
      <h1 className="mt-2 text-xl font-semibold tracking-tight text-sg-neutral-900">
        Halaman tidak ditemukan
      </h1>
      <span className="mx-auto mt-3 block h-0.5 w-8 rounded-full bg-tri-navy" aria-hidden />
      <p className="mt-3 text-sm text-sg-neutral-600">
        Alamat yang Anda tuju tidak ada, atau objeknya tidak tersedia bagi akun Anda. Periksa
        kembali tautannya, atau kembali ke beranda.
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
