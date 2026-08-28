import { randomUUID } from 'node:crypto'
import { Injectable, type NestMiddleware } from '@nestjs/common'
import type { NextFunction, Response } from 'express'
import type { SigapRequest } from './request.types.js'
import { runWithRequestContext } from '../request-context/request-context.js'
import { AuthService } from '../identity/auth.service.js'
import type { Principal } from '../authz/principal.js'

/**
 * Establishes request context for everything downstream.
 *
 * This is middleware rather than a guard because AsyncLocalStorage has to WRAP
 * the remainder of the request: `runWithRequestContext(ctx, next)` puts the
 * controller, the services and the audit write inside the same async scope. A
 * guard returns before the handler runs, so a context established there would
 * already be gone by the time anything needed it.
 *
 * An invalid or absent token is not rejected here -- it produces a context with
 * no actor, and the guard decides whether that is acceptable for the route.
 * Authentication and authorisation stay separate.
 */
@Injectable()
export class ContextMiddleware implements NestMiddleware {
  constructor(private readonly auth: AuthService) {}

  async use(req: SigapRequest, res: Response, next: NextFunction): Promise<void> {
    const requestId = (req.header('X-Request-Id') ?? `req_${randomUUID()}`).slice(0, 100)
    req.requestId = requestId
    res.setHeader('X-Request-Id', requestId)

    const ipAddress = req.ip ?? req.socket.remoteAddress ?? 'unknown'
    const header = req.header('Authorization')
    const token = header?.startsWith('Bearer ') ? header.slice(7) : null

    let principal: Principal | null = null
    let sessionId: string | null = null

    if (token) {
      const resolved = await this.auth.authenticate(token)
      if (resolved) {
        principal = resolved.principal
        sessionId = resolved.sessionId
        req.principal = resolved.principal
        req.sessionId = resolved.sessionId
      }
    }

    runWithRequestContext(
      {
        requestId,
        actorId: principal?.userId ?? null,
        actorRoles: principal?.roles ?? [],
        sessionId,
        ipAddress,
      },
      () => next(),
    )
  }
}
