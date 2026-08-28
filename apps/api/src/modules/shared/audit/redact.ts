/**
 * FR-X-008 rule 6 -- passwords, tokens and keys are masked in before/after
 * values before they reach audit_log.
 *
 * This has to happen on the way IN. audit_log rows cannot be updated by design
 * (ADR-04), so a secret written into one is written forever: there is no later
 * pass that can clean it up, and the row cannot even be deleted. Redaction
 * added after the fact protects nothing already stored.
 *
 * Matching is per key segment, not substring. `password` matches, `monkey`
 * does not -- substring matching on "key" would redact half the payload and
 * substring matching is how these filters usually go wrong.
 *
 * The bias is deliberately toward over-redaction. Losing one field's detail in
 * an audit row is recoverable through other evidence; a leaked credential in an
 * immutable table is not.
 */

export const REDACTED = '[DISAMARKAN]'

const SENSITIVE_SEGMENTS = new Set([
  'password',
  'passwd',
  'pass',
  'sandi',
  'katasandi',
  'token',
  'secret',
  'rahasia',
  'credential',
  'credentials',
  'kredensial',
  'otp',
  'pin',
  'key',
  'apikey',
  'privatekey',
  'authorization',
  'cookie',
  'signature',
  'salt',
])

/**
 * `refresh_token`, `refreshToken`, `REFRESH-TOKEN` and `refresh token` all
 * split to the same segments.
 */
function segmentsOf(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((segment) => segment.toLowerCase())
}

function isSensitiveKey(key: string): boolean {
  return segmentsOf(key).some((segment) => SENSITIVE_SEGMENTS.has(segment))
}

/**
 * Depth guard: a hostile or merely malformed payload must not be able to turn
 * an audit write into a stack overflow, because a failed audit write rolls back
 * the business transaction with it (FR-X-008 Validasi).
 */
const MAX_DEPTH = 12

export function redactSensitive(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED
  if (value === null || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitive(item, depth + 1))
  }

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = isSensitiveKey(key) ? REDACTED : redactSensitive(item, depth + 1)
  }
  return out
}
