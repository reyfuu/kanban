/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  // Seluruh sistem berjalan on-premise (04-TRD §5.1). Tidak ada pengoptimal
  // gambar pihak ketiga, tidak ada pemuatan fon dari jaringan luar.
  images: { unoptimized: true },
}

export default nextConfig
