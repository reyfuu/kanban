import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * Who is acting, on what request.
 *
 * FR-X-008 rule 1 requires every audit row to carry the actor, the roles that
 * were effective at the moment of the action, the session, the request id and
 * the source IP. Threading all of that through every service signature would
 * mean the one time somebody forgets, the audit row is silently poorer than the
 * requirement demands -- and audit rows cannot be corrected afterwards.
 *
 * So it rides in async local storage instead, populated once per request and
 * read by AuditService. `actorRoles` is a snapshot taken at authentication
 * time, not a live lookup: FR-X-008 asks what the actor's roles WERE, and a
 * role revoked mid-request must not rewrite the history of what already
 * happened under it.
 */
export interface RequestContext {
  readonly requestId: string
  readonly actorId: string | null
  readonly actorRoles: readonly string[]
  readonly sessionId: string | null
  readonly ipAddress: string | null
}

const storage = new AsyncLocalStorage<RequestContext>()

export function runWithRequestContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn)
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore()
}
