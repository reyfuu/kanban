import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, parse } from 'node:path'

/**
 * Loads the workspace `.env`, wherever the process was started from.
 *
 * `bun run --filter` runs with the package as cwd, `bun dist/main.js` may run
 * from the repository root, and a container runs from somewhere else again. A
 * fixed relative path is correct for exactly one of those and fails silently
 * for the rest -- and the failure surfaces as "DATABASE_URL not found" during
 * DI, which reads like a configuration mistake rather than a path bug.
 *
 * So walk up until a `.env` appears. Real environment variables always win,
 * which is what lets a container or systemd unit override the file.
 *
 * Import this before anything that reads process.env at module scope.
 */
export function loadWorkspaceEnv(startDir: string = process.cwd()): string | null {
  let dir = startDir
  const root = parse(dir).root

  while (true) {
    const candidate = join(dir, '.env')
    if (existsSync(candidate)) {
      applyEnvFile(candidate)
      return candidate
    }
    if (dir === root) return null
    dir = dirname(dir)
  }
}

/**
 * Parse a `.env` and apply it without clobbering the real environment.
 *
 * This was `process.loadEnvFile`, which is built into Node 22 and needed no
 * dependency. It is not implemented in Bun, and the failure is not the kind
 * that degrades gracefully: the process dies at the first import with
 * "process.loadEnvFile is not a function", before any of the configuration it
 * was supposed to read is even looked at.
 *
 * Reimplemented rather than swapped for `dotenv` because the two differ on the
 * point that matters here. `dotenv` overwrites nothing by default either, but
 * it also expands `${VAR}` references and honours `export ` prefixes, so a
 * `.env` written for one is not guaranteed to mean the same thing under the
 * other. The behaviours below were read off Node 22 directly, not from memory:
 *
 *   - a variable already present in the environment is left alone, so a
 *     container or systemd override still wins over the file;
 *   - surrounding single or double quotes are stripped;
 *   - blank lines and `#` comments are skipped;
 *   - an empty value yields an empty string, not an absent key.
 *
 * Deliberately not supported, because Node does not support it either and
 * silently adding it would make a `.env` behave differently depending on which
 * runtime read it: `${VAR}` interpolation and multi-line values.
 */
function applyEnvFile(path: string): void {
  const text = readFileSync(path, 'utf8')

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (line === '' || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue

    const key = line.slice(0, eq).trim()
    if (key === '') continue

    // An existing value wins. Checked with `in` rather than a truthiness test
    // so that a variable deliberately set to the empty string stays empty
    // instead of being quietly refilled from the file.
    if (key in process.env) continue

    let value = line.slice(eq + 1).trim()
    const quote = value[0]
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}
