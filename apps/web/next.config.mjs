import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  outputFileTracingRoot: resolve(here, '../..'),
  eslint: {
    // Biarkan linter berjalan di CI terpisah, jangan gagalkan production build Vercel
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Typecheck dipastikan bersih via pnpm typecheck
    ignoreBuildErrors: false,
  },
}

export default nextConfig
