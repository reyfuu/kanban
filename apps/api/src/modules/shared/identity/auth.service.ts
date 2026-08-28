import { Injectable, UnauthorizedException } from '@nestjs/common'
import { UnitOfWork } from '../audit/unit-of-work.js'
import { runWithRequestContext } from '../request-context/request-context.js'
import { AuthzService } from '../authz/authz.service.js'
import type { Principal } from '../authz/principal.js'
import { IdentityProvider } from './identity-provider.js'
import { SESSION_IDLE_MINUTES, SessionService } from './session.service.js'

export interface LoginResult {
  readonly accessToken: string
  readonly expiresIn: number
  readonly principal: Principal
}

/**
 * Login, session resolution and logout (FR-X-001 s.d. FR-X-004).
 *
 * DEVIATION FROM 07-API-CONTRACT Sec 2.1, recorded here so it is a decision and
 * not an accident: the contract shows a JWT `access_token` alongside a separate
 * `refresh_token`. That split exists so an access token can be validated
 * without touching the database. FR-X-002 makes that impossible anyway -- the
 * idle window slides on every request, sessions can be terminated remotely, and
 * rule 3 requires a role change to affect sessions already open. All three need
 * a database read per request, so a stateless token would buy nothing while
 * adding a second credential to leak and a signing key to rotate.
 *
 * So there is one opaque token. It is the access credential and the refresh
 * credential, because the session is server-side and simply slides. This needs
 * to go back into the API contract via doc-sync.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly identity: IdentityProvider,
    private readonly sessions: SessionService,
    private readonly authz: AuthzService,
    private readonly uow: UnitOfWork,
  ) {}

  async login(input: {
    username: string
    password: string
    ipAddress: string
    userAgent: string | null
    requestId: string
  }): Promise<LoginResult> {
    // FR-X-001 Validasi: a directory failure denies access. It must never fall
    // through to "allow" -- so the failure path here is the same as the
    // wrong-password path, and there is no catch that swallows it.
    const principalIdentity = await this.identity.authenticate({
      username: input.username,
      password: input.password,
    })

    // One message for bad credentials, unknown accounts and accounts disabled
    // in the directory. Distinguishing them tells an attacker which usernames
    // exist (FR-X-001 Kesalahan).
    if (!principalIdentity) throw new UnauthorizedException('Nama pengguna atau kata sandi salah.')

    const active = await this.identity.isActive(principalIdentity.externalId)
    if (!active) throw new UnauthorizedException('Nama pengguna atau kata sandi salah.')

    const user = await this.authz.resolveByExternalId(principalIdentity.externalId)
    if (!user) throw new UnauthorizedException('Nama pengguna atau kata sandi salah.')

    // The session row and its audit entry are written in one transaction. The
    // request context is established first because the actor of "MASUK" is the
    // user who just authenticated -- there is no earlier context to inherit.
    return runWithRequestContext(
      {
        requestId: input.requestId,
        actorId: user.userId,
        actorRoles: user.roles,
        sessionId: null,
        ipAddress: input.ipAddress,
      },
      async () =>
        this.uow.write(async (tx, audit) => {
          const session = await this.sessions.issue(tx, {
            userId: user.userId,
            ipAddress: input.ipAddress,
            userAgent: input.userAgent,
          })

          await tx.appUser.update({
            where: { id: user.userId },
            data: { lastLoginAt: new Date() },
          })

          await audit.record({
            action: 'MASUK',
            objectType: 'APP_USER',
            objectId: user.userId,
            after: {
              provider: this.identity.name,
              session_id: session.sessionId,
              ip_address: input.ipAddress,
            },
          })

          return {
            accessToken: session.refreshToken,
            expiresIn: SESSION_IDLE_MINUTES * 60,
            principal: user,
          }
        }),
    )
  }

  /** Resolves a bearer token to its principal, sliding the idle window. */
  async authenticate(token: string): Promise<{ principal: Principal; sessionId: string } | null> {
    const session = await this.sessions.touch(token)
    if (!session) return null

    const principal = await this.authz.resolve(session.userId)
    if (!principal) return null

    return { principal, sessionId: session.sessionId }
  }

  async logout(input: {
    sessionId: string
    principal: Principal
    requestId: string
    ipAddress: string
  }): Promise<void> {
    await runWithRequestContext(
      {
        requestId: input.requestId,
        actorId: input.principal.userId,
        actorRoles: input.principal.roles,
        sessionId: input.sessionId,
        ipAddress: input.ipAddress,
      },
      async () =>
        this.uow.write(async (tx, audit) => {
          await this.sessions.revoke(tx, {
            sessionId: input.sessionId,
            byUserId: input.principal.userId,
            reason: 'LOGOUT',
          })
          await audit.record({
            action: 'KELUAR',
            objectType: 'SESSION',
            objectId: input.sessionId,
          })
        }),
    )
  }
}
