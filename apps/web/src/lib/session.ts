import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { apiFetch, ApiError, SESSION_COOKIE } from './api'

export interface CurrentUser {
  id: string
  external_id: string
  full_name: string
  roles: string[]
  permissions: string[]
  scopes: Record<string, string[]>
  delegations_received: { from_user: { id: string; full_name: string } }[]
}

/**
 * The signed-in user, or null.
 *
 * Resolved from the API on every render rather than cached in the cookie. The
 * cookie holds only the token; roles and permissions come fresh each time, so
 * FR-X-002 rule 3 -- a role change takes effect on sessions already open --
 * holds in the UI as well as in the API. A cached role list in a cookie would
 * keep showing a revoked user their old menu until they signed out.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  if (!token) return null

  try {
    return await apiFetch<CurrentUser>('/auth/me')
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return null
    throw error
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser()
  if (!user) redirect('/masuk')
  return user
}

export function hasPermission(user: CurrentUser, permission: string): boolean {
  return user.permissions.includes(permission)
}
