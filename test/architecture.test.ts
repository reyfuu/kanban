import { readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MODULES } from '../eslint.config.mjs'

const moduleRoot = fileURLToPath(new URL('../apps/api/src/modules', import.meta.url))

/**
 * ADR-01 enforcement, checked rather than assumed.
 *
 * The lint rule generates its boundary zones from the MODULES list. Add a
 * directory under modules/ without adding it to that list and the new module is
 * silently unguarded — lint stays green while any module may reach into its
 * internals. Lint cannot catch this, because lint is the thing with the gap.
 *
 * So the filesystem is the source of truth here, and MODULES must agree with it.
 */
describe('ADR-01 · batas modul', () => {
  const dirs = readdirSync(moduleRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  it('setiap modul punya berkas antarmuka publik', () => {
    for (const dir of dirs) {
      expect(existsSync(join(moduleRoot, dir, 'index.ts')), `${dir}/index.ts hilang`).toBe(true)
    }
  })

  it('aturan lint mencakup setiap modul yang ada di disk', () => {
    expect([...MODULES].sort()).toEqual(dirs)
  })
})
