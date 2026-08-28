import { describe, expect, it } from 'vitest'
import { REDACTED, redactSensitive } from '../src/modules/shared/audit/redact.js'

/**
 * FR-X-008 rule 6. These are not style tests: a secret that reaches audit_log
 * cannot be removed afterwards, because the table rejects UPDATE and DELETE.
 */
describe('FR-X-008 aturan 6 · penyamaran rahasia', () => {
  it('menyamarkan kata sandi dan token dalam berbagai gaya penamaan', () => {
    const out = redactSensitive({
      password: 'p',
      refresh_token: 't',
      refreshToken: 't',
      'API-KEY': 'k',
      kataSandi: 's',
    }) as Record<string, unknown>

    for (const key of Object.keys(out)) {
      expect(out[key], key).toBe(REDACTED)
    }
  })

  it('tidak menyamarkan bidang yang hanya mengandung potongan kata', () => {
    const out = redactSensitive({
      monkey: 'ok',
      keyword: 'ok',
      passenger: 'ok',
      // `hash` and `prev_hash` are audit chain columns -- redacting them would
      // destroy the very integrity evidence this table exists for.
      hash: 'abc',
      prev_hash: 'def',
    }) as Record<string, string>

    expect(Object.values(out).every((v) => v !== REDACTED)).toBe(true)
  })

  it('menembus objek bersarang dan larik', () => {
    const out = redactSensitive({
      user: { name: 'Budi', credentials: { password: 'x' } },
      sessions: [{ token: 'a' }, { token: 'b' }],
    }) as any

    expect(out.user.name).toBe('Budi')
    expect(out.user.credentials).toBe(REDACTED)
    expect(out.sessions[0].token).toBe(REDACTED)
    expect(out.sessions[1].token).toBe(REDACTED)
  })

  it('tidak meledak pada bersarang ekstrem', () => {
    let deep: Record<string, unknown> = { password: 'x' }
    for (let i = 0; i < 200; i++) deep = { nested: deep }

    // A failed audit write rolls back the business transaction (FR-X-008
    // Validasi), so a stack overflow here would be a denial of service on every
    // write path in the system.
    expect(() => redactSensitive(deep)).not.toThrow()
  })

  it('membiarkan nilai primitif apa adanya', () => {
    expect(redactSensitive('teks')).toBe('teks')
    expect(redactSensitive(42)).toBe(42)
    expect(redactSensitive(null)).toBe(null)
  })
})
