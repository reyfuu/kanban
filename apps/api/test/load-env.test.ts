import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { loadWorkspaceEnv } from '../src/load-env.js'

/**
 * `loadWorkspaceEnv` used to delegate to `process.loadEnvFile`, a Node 22
 * built-in that Bun does not implement. Moving the repo to Bun meant parsing
 * `.env` by hand, and a hand-rolled parser that is *almost* right is worse
 * than the built-in it replaced: every one of these behaviours decides whether
 * a deployed container reads its real DATABASE_URL or silently overwrites it
 * with a development value from a file.
 *
 * The expectations below were read off Node 22's own `process.loadEnvFile`
 * rather than written from memory, so this file is a compatibility contract,
 * not a description of whatever the implementation happens to do.
 */

const OWNED = [
  'SIGAP_T_PLAIN',
  'SIGAP_T_PRESET',
  'SIGAP_T_DQUOTE',
  'SIGAP_T_SQUOTE',
  'SIGAP_T_COMMENT',
  'SIGAP_T_EMPTY',
  'SIGAP_T_EQUALS',
  'SIGAP_T_EMPTY_PRESET',
]

afterEach(() => {
  for (const key of OWNED) delete process.env[key]
})

function envDir(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), 'sigap-env-'))
  writeFileSync(join(dir, '.env'), contents)
  return dir
}

describe('loadWorkspaceEnv · kesetaraan dengan process.loadEnvFile Node', () => {
  it('memuat nilai biasa dan mengembalikan jalur berkasnya', () => {
    const dir = envDir('SIGAP_T_PLAIN=halo\n')
    const found = loadWorkspaceEnv(dir)

    expect(found).toBe(join(dir, '.env'))
    expect(process.env.SIGAP_T_PLAIN).toBe('halo')
  })

  it('TIDAK menimpa variabel lingkungan yang sudah ada', () => {
    // Aturan terpenting di berkas ini. Kalau terbalik, sebuah kontainer
    // produksi akan menukar DATABASE_URL-nya dengan nilai pengembangan.
    process.env.SIGAP_T_PRESET = 'dari-lingkungan'
    loadWorkspaceEnv(envDir('SIGAP_T_PRESET=dari-berkas\n'))

    expect(process.env.SIGAP_T_PRESET).toBe('dari-lingkungan')
  })

  it('tidak mengisi ulang variabel yang sengaja dikosongkan', () => {
    // Dicek dengan `in`, bukan truthiness: string kosong itu nilai yang sah
    // dan berbeda maknanya dari "belum disetel".
    process.env.SIGAP_T_EMPTY_PRESET = ''
    loadWorkspaceEnv(envDir('SIGAP_T_EMPTY_PRESET=terisi\n'))

    expect(process.env.SIGAP_T_EMPTY_PRESET).toBe('')
  })

  it('melepas tanda kutip ganda dan tunggal', () => {
    loadWorkspaceEnv(
      envDir('SIGAP_T_DQUOTE="ada spasi"\nSIGAP_T_SQUOTE=\'tunggal\'\n'),
    )

    expect(process.env.SIGAP_T_DQUOTE).toBe('ada spasi')
    expect(process.env.SIGAP_T_SQUOTE).toBe('tunggal')
  })

  it('melewati komentar dan baris kosong', () => {
    loadWorkspaceEnv(envDir('\n# SIGAP_T_COMMENT=jangan\n\nSIGAP_T_PLAIN=ya\n'))

    expect(process.env.SIGAP_T_COMMENT).toBeUndefined()
    expect(process.env.SIGAP_T_PLAIN).toBe('ya')
  })

  it('nilai kosong menjadi string kosong, bukan kunci yang hilang', () => {
    loadWorkspaceEnv(envDir('SIGAP_T_EMPTY=\n'))

    expect(process.env.SIGAP_T_EMPTY).toBe('')
  })

  it('hanya memisah pada tanda sama dengan pertama', () => {
    // URL koneksi dan token rutin mengandung "=" di dalam nilainya.
    loadWorkspaceEnv(envDir('SIGAP_T_EQUALS=a=b=c\n'))

    expect(process.env.SIGAP_T_EQUALS).toBe('a=b=c')
  })

  it('menaiki direktori induk sampai menemukan .env', () => {
    const dir = envDir('SIGAP_T_PLAIN=dariatas\n')
    const nested = join(dir, 'apps', 'api')
    mkdirSync(nested, { recursive: true })

    expect(loadWorkspaceEnv(nested)).toBe(join(dir, '.env'))
    expect(process.env.SIGAP_T_PLAIN).toBe('dariatas')
  })

  it('mengembalikan null bila tidak ada .env sampai akar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sigap-noenv-'))

    expect(loadWorkspaceEnv(dir)).toBeNull()
  })
})
