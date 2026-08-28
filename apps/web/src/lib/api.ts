import { cookies } from 'next/headers'

/**
 * Server-side API client.
 *
 * Every call to the SIGAP API happens on the Next server, never from the
 * browser, and the session token lives in an httpOnly cookie. The browser is
 * therefore never handed a credential it could leak through XSS, a third-party
 * script, or an extension.
 *
 * That matters more here than in most products: this token carries whatever
 * authority its holder has over audit evidence and access reviews, and every
 * action taken with it is attributed to that person in a table that cannot be
 * corrected afterwards.
 */
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3001'
export const SESSION_COOKIE = 'sigap_session'

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors?: { field: string; message: string }[],
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Omit the session token -- only for login. */
  anonymous?: boolean
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' }

  if (!options.anonymous) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value
    if (token) headers.Authorization = `Bearer ${token}`
  }
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'

  // The key is omitted rather than set to undefined: exactOptionalPropertyTypes
  // treats those as different things, and RequestInit does not accept undefined.
  const init: RequestInit = {
    method: options.method ?? 'GET',
    headers,
    // Governance data is never stale-cacheable: a revoked role or a closed
    // campaign must not keep rendering from a cache.
    cache: 'no-store',
  }
  if (options.body !== undefined) init.body = JSON.stringify(options.body)

  const response = await fetch(`${API_BASE}/api/v1${path}`, init)

  if (response.status === 204) return undefined as T

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.code ?? 'UNKNOWN',
      payload?.detail ?? 'Terjadi kesalahan yang tidak terduga.',
      Array.isArray(payload?.errors)
        ? payload.errors.map((e: { field: string; message: string }) => ({
            field: e.field,
            message: e.message,
          }))
        : undefined,
    )
  }

  return payload?.data as T
}
