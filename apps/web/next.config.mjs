import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  // Pin the workspace root. Next infers it by looking for lockfiles, and any
  // stray package-lock.json in a parent directory -- a home directory, for
  // instance -- wins over this repo's pnpm-lock.yaml. It then traces files from
  // the wrong root, which shows up as a startup warning now and as missing
  // files in a standalone build later.
  outputFileTracingRoot: resolve(here, '../..'),

  // Seluruh sistem berjalan on-premise (04-TRD §5.1). Tidak ada pengoptimal
  // gambar pihak ketiga, tidak ada pemuatan fon dari jaringan luar.
  images: { unoptimized: true },
}

export default nextConfig
