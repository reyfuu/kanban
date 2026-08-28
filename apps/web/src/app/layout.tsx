import type { Metadata } from 'next'
import { Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

export const metadata: Metadata = {
  title: 'SIGAP',
  description: 'Sistem Integrasi Governance, Akses, dan Prosedur',
}

/*
 * The two typefaces 06-DESIGN §2.5 mandates: Inter for the interface, JetBrains
 * Mono for the values that get compared character by character -- cryptographic
 * fingerprints, entitlement codes, ticket numbers, document codes. Loaded through
 * next/font so they are self-hosted at build time (no runtime request to Google,
 * no layout shift, and it works on an air-gapped deploy once built). Each exposes
 * a CSS variable that tokens.css binds to --sg-font-sans / --sg-font-mono.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains-mono',
})

/**
 * Bahasa antarmuka adalah Bahasa Indonesia (CLAUDE.md). `lang="id"` bukan
 * kosmetik — pembaca layar memakainya untuk memilih pelafalan, dan tanpa itu
 * teks Indonesia dibacakan dengan fonetik Inggris.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
