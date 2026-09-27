import type { Metadata, Viewport } from 'next';
import { Analytics } from '@vercel/analytics/react';
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
  themeColor: '#101414',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <head />
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
