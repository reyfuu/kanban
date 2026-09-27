import type { Metadata, Viewport } from 'next';
// @vercel/analytics is installed at Vercel build time via package.json
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Analytics } = require('@vercel/analytics/react') as typeof import('@vercel/analytics/react');
import './globals.css';

export const metadata: Metadata = {
  title: 'HoyoKanban — Genshin Impact & ZZZ Progress Tracker',
  description:
    'Sistem Kanban visual untuk pelacakan build karakter, kalkulator material, live stamina hub Resin & Battery, dan rotasi farming harian. Genshin Impact & Zenless Zone Zero.',
  keywords: ['genshin impact', 'zenless zone zero', 'zzz', 'kanban', 'character builder', 'resin tracker', 'hoyo'],
  openGraph: {
    title: 'HoyoKanban',
    description: 'Track karakter Genshin & ZZZ dengan visual Kanban board',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f172a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className="dark">
      <head />
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
