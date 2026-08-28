'use client'
/* eslint-disable no-restricted-syntax --
 * Aturan kode #6 (warna hanya lewat token) sengaja dikecualikan di berkas ini
 * saja. Batas ini menggantikan root layout ketika root layout sendiri gagal --
 * termasuk kemungkinan gagal sebelum lembar gaya termuat, yang membuat kelas
 * token tidak menghasilkan warna apa pun. Nilai di bawah adalah salinan harfiah
 * dari token 06-DESIGN §2 (neutral-50/900/700 dan tri-navy), bukan warna baru.
 */
/**
 * The last-resort boundary: an error thrown in the root layout itself, where
 * no other boundary exists and Next.js would otherwise render its own English
 * screen. It must supply <html>/<body> because it replaces the root layout.
 *
 * Deliberately styled with plain inline rules rather than tokens: if the
 * failure happened before the stylesheet loaded, token classes render nothing
 * and the user gets an unreadable page.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="id">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f8fafc' }}>
        <main
          role="alert"
          style={{ maxWidth: '32rem', margin: '4rem auto', padding: '0 1rem', color: '#0f172a' }}
        >
          <h1 style={{ fontSize: '1.125rem', margin: 0 }}>SIGAP tidak dapat menampilkan halaman.</h1>
          <p style={{ fontSize: '0.875rem', color: '#334155' }}>
            Terjadi gangguan mendasar pada antarmuka. Coba muat ulang; bila berulang, hubungi
            administrator sistem.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              minHeight: '2.75rem',
              padding: '0 1rem',
              borderRadius: '0.5rem',
              border: '1px solid #0b2545',
              background: '#0b2545',
              color: '#ffffff',
              fontSize: '0.875rem',
              cursor: 'pointer',
            }}
          >
            Muat ulang
          </button>
        </main>
      </body>
    </html>
  )
}
