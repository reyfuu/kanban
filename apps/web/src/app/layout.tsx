import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SIGAP',
  description: 'Sistem Integrasi Governance, Akses, dan Prosedur',
}

/**
 * Bahasa antarmuka adalah Bahasa Indonesia (CLAUDE.md). `lang="id"` bukan
 * kosmetik — pembaca layar memakainya untuk memilih pelafalan, dan tanpa itu
 * teks Indonesia dibacakan dengan fonetik Inggris.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  )
}
