import { defineConfig } from 'vitest/config'
import { loadWorkspaceEnv } from './apps/api/src/load-env.js'

// Integration tests talk to the dev database and need the same .env the
// application uses.
//
// This called `process.loadEnvFile` directly until the repo moved to Bun, which
// does not implement it. Reusing the application's own loader is better than
// re-fixing the same problem twice: the test run and the running API now read
// `.env` through one code path, so they cannot disagree about what a given file
// means. An absent `.env` is fine for unit tests, and integration tests fail
// loudly on their own when DATABASE_URL is missing.
loadWorkspaceEnv()

export default defineConfig({
  test: {
    include: ['{apps,packages,test}/**/*.{test,spec}.{ts,tsx}'],
    environment: 'node',
    // Audit chain writes serialise on a database advisory lock by design
    // (ADR-04). Parallel files would queue behind each other and read as a hang.
    fileParallelism: false,
  },
})
