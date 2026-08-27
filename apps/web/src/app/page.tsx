/**
 * Penampung sementara. Layar sebenarnya mengikuti 05-UIUX-FLOW; layar pertama
 * yang dibangun adalah SC-01 (Masuk) dan SC-02 (Beranda per peran).
 *
 * Kelas warna di bawah sengaja memakai token (`bg-sg-*`, `text-sg-*`) alih-alih
 * palet bawaan Tailwind. Selain benar menurut aturan kode #6, ini juga berfungsi
 * sebagai uji asap: kalau lapisan @theme putus, halaman ini kehilangan warnanya
 * dan kegagalannya terlihat, bukan senyap.
 */
export default function Page() {
  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="text-2xl font-semibold text-sg-neutral-900">SIGAP</h1>
      <p className="mt-2 text-sm text-sg-neutral-600">
        Sistem Integrasi Governance, Akses, dan Prosedur
      </p>
      <p className="mt-6 rounded-md border border-sg-warning-500 bg-sg-warning-50 p-4 text-sm text-sg-warning-700">
        Fondasi Fase 1 sedang dibangun. Layar belum tersedia.
      </p>
    </main>
  )
}
