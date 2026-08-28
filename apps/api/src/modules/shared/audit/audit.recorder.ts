import { Prisma } from '@prisma/client'
import type { TransactionClient } from '../prisma/prisma.service.js'
import { getRequestContext } from '../request-context/request-context.js'
import { redactSensitive } from './redact.js'
import { type AuditEntry, MissingActorError } from './audit.types.js'

/**
 * Serialises audit chain writes.
 *
 * hash(n) embeds hash(n-1), so two transactions that read the same tail and
 * both append produce two rows claiming the same predecessor -- a forked chain
 * that verify_audit_chain reports as broken. Nothing in the schema prevents
 * that; ADR-04 notes audit writes are inherently sequential but leaves the
 * serialisation to us.
 *
 * The lock is transaction-scoped, so it releases when the business transaction
 * commits or rolls back. It is held for the duration of the surrounding write,
 * which is the point: the chain is a single ordered structure and appending to
 * it is not a parallelisable operation.
 *
 * A benign broken chain is worse than it sounds. If verification reports false
 * regularly for innocent reasons, reviewers learn to ignore it, and real
 * tampering hides inside that noise.
 */
const AUDIT_CHAIN_LOCK_KEY = 8612004071001n

export class AuditRecorder {
  private recorded = 0

  constructor(private readonly tx: TransactionClient) {}

  get count(): number {
    return this.recorded
  }

  async record(entry: AuditEntry): Promise<void> {
    const context = getRequestContext()
    if (!context?.actorId) throw new MissingActorError()

    if (this.recorded === 0) {
      await this.tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_KEY})`
    }

    const tail = await this.tx.$queryRaw<{ hash: string }[]>`
      SELECT hash FROM public.audit_log ORDER BY id DESC LIMIT 1
    `
    const prevHash = tail[0]?.hash ?? null

    const before = entry.before === undefined ? null : JSON.stringify(redactSensitive(entry.before))
    const after = entry.after === undefined ? null : JSON.stringify(redactSensitive(entry.after))

    // occurred_at is taken once inside SQL and used for BOTH the stored column
    // and the hash input. Computing it in application code and sending it twice
    // would let the two drift apart, and a hash over a timestamp that is not
    // the stored timestamp verifies as broken forever.
    await this.tx.$executeRaw`
      WITH moment AS (SELECT now() AS occurred_at)
      INSERT INTO public.audit_log (
        occurred_at, actor_id, actor_role_at_action, session_id, request_id,
        action, object_type, object_id, before_value, after_value, ip_address,
        prev_hash, hash
      )
      SELECT
        moment.occurred_at,
        ${context.actorId}::uuid,
        ${[...context.actorRoles]}::text[],
        ${context.sessionId}::uuid,
        ${context.requestId},
        ${entry.action},
        ${entry.objectType},
        ${entry.objectId}::uuid,
        ${before}::jsonb,
        ${after}::jsonb,
        ${context.ipAddress}::varchar,
        ${prevHash},
        public.sigap_audit_hash(
          ${prevHash}, moment.occurred_at, ${context.actorId}::uuid, ${entry.action},
          ${entry.objectType}, ${entry.objectId}::uuid, ${before}::jsonb, ${after}::jsonb
        )
      FROM moment
    `

    this.recorded += 1
  }
}

export { Prisma }
