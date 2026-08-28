import { randomUUID } from 'node:crypto'
import { Injectable, type OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common'
import Redis from 'ioredis'
import { ensureRedisReady } from '../shared/index.js'
import type { RowIssue } from './snapshot-csv.js'

/** 07-API-CONTRACT Sec 5.3 shows `expires_at` roughly half an hour out. */
const TTL_SECONDS = 1_800

/** What validate() parked and commit() picks up. */
export interface StagedUpload {
  readonly applicationId: string
  /** The user who validated. Only they may commit it. */
  readonly userId: string
  readonly fileName: string
  readonly totalRows: number
  readonly rows: readonly StagedRow[]
  readonly issues: readonly RowIssue[]
  readonly warnings: readonly StagedWarning[]
}

export interface StagedWarning {
  readonly code: string
  readonly severity: string
  readonly message: string
  readonly requiresConfirmation: boolean
}

/** A validated row, dates already narrowed to ISO strings for JSON transit. */
export interface StagedRow {
  readonly row: number
  readonly accountId: string
  readonly accountName: string
  readonly entitlementCode: string
  readonly accountStatus: string
  readonly employeeNumber: string | null
  readonly displayName: string | null
  readonly email: string | null
  readonly lastAccessAt: string | null
  readonly grantedAt: string | null
  readonly grantedBy: string | null
}

/**
 * Holds a validated-but-not-yet-committed upload between the two calls of
 * FR-B-004 aturan 3 and 4.
 *
 * Redis rather than the process, for the same reason step-up tokens live
 * there: with more than one API instance, "which upload is this validation_id"
 * must have one answer. It is also the only store here with an expiry, and an
 * expiry is what makes `expires_at` in the response true rather than decorative.
 *
 * Nothing here is authoritative. This is a scratch area for rows that have
 * passed validation and not yet become a snapshot; if it is lost, the author
 * re-uploads the file. That is why a Redis outage fails the upload loudly
 * instead of degrading into some partially-staged state.
 */
@Injectable()
export class SnapshotStagingStore implements OnModuleDestroy {
  private readonly redis = new Redis(
    process.env.REDIS_URL ?? `redis://localhost:${process.env.REDIS_PORT ?? 6389}`,
    { lazyConnect: true, maxRetriesPerRequest: 1, enableOfflineQueue: false, connectTimeout: 2_000 },
  )

  private static key(validationId: string): string {
    return `sigap:snapshot-upload:${validationId}`
  }

  async put(staged: StagedUpload): Promise<{ validationId: string; expiresAt: Date }> {
    const validationId = randomUUID()
    try {
      await ensureRedisReady(this.redis)
      await this.redis.set(
        SnapshotStagingStore.key(validationId),
        JSON.stringify(staged),
        'EX',
        TTL_SECONDS,
      )
    } catch {
      throw new ServiceUnavailableException(
        'Penyimpanan sementara tidak dapat dihubungi; unggahan tidak dapat divalidasi saat ini.',
      )
    }
    return { validationId, expiresAt: new Date(Date.now() + TTL_SECONDS * 1_000) }
  }

  async get(validationId: string): Promise<StagedUpload | null> {
    try {
      await ensureRedisReady(this.redis)
      const raw = await this.redis.get(SnapshotStagingStore.key(validationId))
      return raw === null ? null : (JSON.parse(raw) as StagedUpload)
    } catch {
      throw new ServiceUnavailableException(
        'Penyimpanan sementara tidak dapat dihubungi; unggahan tidak dapat dilanjutkan saat ini.',
      )
    }
  }

  /**
   * Called only after the snapshot has committed. Dropping the staging entry
   * before the transaction succeeds would leave an author with a validation id
   * that no longer resolves and a snapshot that was never written.
   */
  async drop(validationId: string): Promise<void> {
    try {
      await ensureRedisReady(this.redis)
      await this.redis.del(SnapshotStagingStore.key(validationId))
    } catch {
      // The TTL will collect it. Failing the request here would report a
      // failure for an upload that has already landed.
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.redis.disconnect()
  }
}
