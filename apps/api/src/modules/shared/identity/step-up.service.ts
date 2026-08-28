import { createHash, randomBytes } from 'node:crypto'
import { Injectable, type OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common'
import Redis from 'ioredis'
import { ensureRedisReady } from '../redis/redis.connect.js'

/** FR-X-003: "berlaku maksimal 5 menit". Configurable downwards, never upwards. */
const MAX_TTL_SECONDS = 300

function ttlSeconds(): number {
  const raw = Number(process.env.STEP_UP_TTL_SECONDS)
  return Number.isFinite(raw) && raw > 0 && raw < MAX_TTL_SECONDS ? Math.floor(raw) : MAX_TTL_SECONDS
}

function redisUrl(): string {
  return process.env.REDIS_URL ?? `redis://localhost:${process.env.REDIS_PORT ?? 6389}`
}

/**
 * Short-lived re-authentication tokens (FR-X-003).
 *
 * Held in Redis rather than in the process, because "is this token still
 * valid" must give the same answer on every API instance. An in-memory map
 * survives exactly one process, and the way that breaks is not a crash -- it
 * is a second instance happily refusing a token the first one issued, or
 * worse, a restart quietly widening the window because nothing was expired.
 *
 * Three properties, each of which is the control rather than a nicety:
 *
 * 1. The token is stored HASHED. Redis holds a queue and a cache; it is not
 *    the place to keep live credentials for signing off an access review.
 * 2. The token is bound to the session AND the user that produced it. FR-X-003
 *    exists so that a walk-up attacker at an unlocked screen cannot sign off;
 *    a token that any session could present would restore exactly that.
 * 3. Everything fails closed. If Redis cannot be reached, no token is issued
 *    and no token verifies -- the sensitive action is refused. The alternative,
 *    degrading to "allow", turns an infrastructure outage into a bypass of a
 *    control whose whole purpose is to be hard to bypass.
 */
@Injectable()
export class StepUpService implements OnModuleDestroy {
  private readonly redis = new Redis(redisUrl(), {
    lazyConnect: true,
    // Fail fast and loudly. A step-up check that hangs is a sign-off dialog
    // that hangs, and the operator response to that is to retry, not to wait.
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
    connectTimeout: 2_000,
  })

  private static key(token: string): string {
    return `sigap:stepup:${createHash('sha256').update(token).digest('hex')}`
  }

  /** Binds the token to the session it was minted for; verify checks the pair. */
  private static binding(userId: string, sessionId: string): string {
    return `${userId}:${sessionId}`
  }

  async issue(input: { userId: string; sessionId: string }): Promise<{ token: string; expiresIn: number }> {
    const token = `su_${randomBytes(32).toString('base64url')}`
    const expiresIn = ttlSeconds()

    try {
      await ensureRedisReady(this.redis)
      await this.redis.set(
        StepUpService.key(token),
        StepUpService.binding(input.userId, input.sessionId),
        'EX',
        expiresIn,
      )
    } catch {
      throw new ServiceUnavailableException(
        'Autentikasi ulang tidak dapat diproses saat ini. Coba lagi beberapa saat lagi.',
      )
    }

    return { token, expiresIn }
  }

  /**
   * True only for a live token minted by this exact session for this exact
   * user. Any failure -- unknown token, expired, wrong session, Redis down --
   * is false. The caller cannot distinguish them, and should not: telling a
   * holder of a stolen token *why* it was refused is free reconnaissance.
   */
  async verify(input: { token: string; userId: string; sessionId: string }): Promise<boolean> {
    try {
      await ensureRedisReady(this.redis)
      const stored = await this.redis.get(StepUpService.key(input.token))
      return stored === StepUpService.binding(input.userId, input.sessionId)
    } catch {
      return false
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect()
  }
}
