import type { Request } from 'express'
import type { Principal } from '../authz/principal.js'

/**
 * Express request plus what ContextMiddleware attaches.
 *
 * An explicit type rather than a `declare module` augmentation: augmentation
 * silently depends on every consumer resolving the same copy of the Express
 * types, which a hoisted node_modules layout does not guarantee. This is also
 * plainer to read -- the extra fields are visible where they are used instead
 * of appearing by magic.
 *
 * `principal` is optional because public routes have none. AuthGuard is what
 * turns "may be absent" into "is present" for protected routes.
 */
export interface SigapRequest extends Request {
  principal?: Principal
  sessionId?: string
  requestId?: string
}
