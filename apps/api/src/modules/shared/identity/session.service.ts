import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import type { TransactionClient } from '../prisma/prisma.service.js'
import { PrismaService } from '../prisma/prisma.service.js'

/** FR-X-002. Values come from configuration so they can be tuned without a release. */
function minutes(name: string, fallback: number): number {
  const raw = Number(process.env[name])
  return Number.isFinite(raw) && raw > 0 ? raw : fallback
}

export const SESSION_IDLE_MINUTES = minutes('SESSION_IDLE_TIMEOUT_MINUTES', 30)
export const SESSION_ABSOLUTE_HOURS = minutes('SESSION_ABSOLUTE_TIMEOUT_HOURS', 12)

export type RevokeReason =
  | 'LOGOUT'
  | 'REMOTE_TERMINATION'
  | 'IDLE_TIMEOUT'
  | 'ABSOLUTE_TIMEOUT'
  | 'ADMIN_FORCE'
  | 'ROLE_CHANGE'

export interface IssuedSession {
  readonly sessionId: string
  readonly refreshToken: string
  readonly idleExpiresAt: Date
  readonly absoluteExpiresAt: Date
}

/**
 * Server-side sessions (FR-X-002).
 *
 * Deliberately not a stateless JWT. Three requirements in FR-X-002 cannot be met
 * by a self-contained token: a 30-minute idle timeout that slides, remote
 * termination of another active session, and rule 3 -- a role change takes
 * effect on sessions already running. All three need a record the server can
 * read and revoke on each request. A token that cannot be withdrawn until it
 * expires is not a session, it is a bearer certificate.
 */
@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  /** Stored hashed, never in the clear -- a leaked session table must not be a set of live credentials. */
  static hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }

  async issue(
    tx: TransactionClient,
    input: { userId: string; ipAddress: string; userAgent: string | null },
  ): Promise<IssuedSession> {
    const now = new Date()
    const refreshToken = `rt_${randomBytes(32).toString('base64url')}`
    const sessionId = randomUUID()

    const idleExpiresAt = new Date(now.getTime() + SESSION_IDLE_MINUTES * 60_000)
    const absoluteExpiresAt = new Date(now.getTime() + SESSION_ABSOLUTE_HOURS * 3_600_000)

    await tx.session.create({
      data: {
        id: sessionId,
        userId: input.userId,
        issuedAt: now,
        lastActiveAt: now,
        idleExpiresAt,
        absoluteExpiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        refreshTokenHash: SessionService.hashToken(refreshToken),
      },
    })

    return { sessionId, refreshToken, idleExpiresAt, absoluteExpiresAt }
  }

  /**
   * Resolves a session and slides its idle window.
   *
   * Returns null for anything not currently usable -- unknown, revoked, idled
   * out or past its absolute limit. The caller cannot tell which, and that is
   * intentional: FR-X-001 applies the same reasoning to login, and a response
   * that distinguishes "expired" from "never existed" is an oracle.
   */
  async touch(refreshToken: string): Promise<{ sessionId: string; userId: string } | null> {
    const now = new Date()
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: SessionService.hashToken(refreshToken) },
    })

    if (!session || !session.isActive) return null

    if (session.absoluteExpiresAt <= now) {
      await this.revokeById(session.id, 'ABSOLUTE_TIMEOUT')
      return null
    }
    if (session.idleExpiresAt <= now) {
      await this.revokeById(session.id, 'IDLE_TIMEOUT')
      return null
    }

    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        lastActiveAt: now,
        idleExpiresAt: new Date(now.getTime() + SESSION_IDLE_MINUTES * 60_000),
      },
    })

    return { sessionId: session.id, userId: session.userId }
  }

  /**
   * Expiry revocations are system bookkeeping, not user actions, so they carry
   * no actor and do not go through UnitOfWork. FR-X-008 rule 1 wants the actor
   * of an action; inventing one for a clock tick would put a false name in an
   * immutable table.
   */
  private async revokeById(sessionId: string, reason: RevokeReason): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { isActive: false, revokedAt: new Date(), revokeReason: reason },
    })
  }

  async listActive(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, isActive: true },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        issuedAt: true,
        lastActiveAt: true,
        ipAddress: true,
        userAgent: true,
        absoluteExpiresAt: true,
      },
    })
  }

  /** FR-X-002 rule 2 -- a user ends their own session elsewhere. Audited by the caller. */
  async revoke(
    tx: TransactionClient,
    input: { sessionId: string; byUserId: string; reason: RevokeReason },
  ): Promise<boolean> {
    const result = await tx.session.updateMany({
      where: { id: input.sessionId, isActive: true },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: input.byUserId,
        revokeReason: input.reason,
      },
    })
    return result.count > 0
  }

  /** FR-X-002 rule 3 -- a role change applies to sessions already running. */
  async revokeAllForUser(tx: TransactionClient, userId: string, byUserId: string): Promise<number> {
    const result = await tx.session.updateMany({
      where: { userId, isActive: true },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: byUserId,
        revokeReason: 'ROLE_CHANGE',
      },
    })
    return result.count
  }
}
