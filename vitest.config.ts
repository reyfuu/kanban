import { defineConfig } from 'vitest/config'

// Integration tests talk to the dev database and need the same .env the
// application uses. `process.loadEnvFile` is built into Node 22, so this costs
// no dependency and no config plugin.
try {
  process.loadEnvFile('.env')
} catch {
  // Absent .env is fine for unit tests; integration tests fail loudly on their
  // own when DATABASE_URL is missing, with a clearer message than this could give.
}

export default defineConfig({
  test: {
    include: ['{apps,packages,test}/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    // Audit chain writes serialise on a database advisory lock by design
    // (ADR-04). Parallel files would queue behind each other and read as a hang.
    fileParallelism: false,
  },
})
