import { existsSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

/**
 * Loads the workspace `.env`, wherever the process was started from.
 *
 * `pnpm --filter` runs with the package as cwd, `node dist/main.js` may run
 * from the repository root, and a container runs from somewhere else again. A
 * fixed relative path is correct for exactly one of those and fails silently
 * for the rest -- and the failure surfaces as "DATABASE_URL not found" during
 * DI, which reads like a configuration mistake rather than a path bug.
 *
 * So walk up until a `.env` appears. `process.loadEnvFile` is built into Node
 * 22, so this needs no dependency. Real environment variables always win:
 * loadEnvFile does not overwrite what is already set, which is what lets a
 * container or systemd unit override the file.
 *
 * Import this before anything that reads process.env at module scope.
 */
export function loadWorkspaceEnv(startDir: string = process.cwd()): string | null {
  let dir = startDir
  const root = parse(dir).root

  while (true) {
    const candidate = join(dir, '.env')
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate)
      return candidate
    }
    if (dir === root) return null
    dir = dirname(dir)
  }
}
