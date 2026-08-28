import { Injectable } from '@nestjs/common'
import { PrismaService, type TransactionClient } from '../prisma/prisma.service.js'
import { AuditRecorder } from './audit.recorder.js'
import { MissingAuditTrailError } from './audit.types.js'

/**
 * The only sanctioned way to write.
 *
 * CLAUDE.md rule 2 and FR-X-008 Validasi require every write to record an audit
 * entry in the SAME transaction, and require the business transaction to be
 * rolled back if that entry cannot be written. Stated as a convention, that
 * lasts until the first hurried change.
 *
 * So it is enforced structurally instead: this opens the transaction, hands the
 * caller a recorder, and refuses to commit a transaction that recorded nothing.
 * Forgetting the audit entry does not produce an unaudited write -- it produces
 * a failed write, loudly, in development, on the first run.
 *
 * The inverse holds too. Because the recorder writes through the same `tx`, a
 * failed audit insert aborts the business changes with it. Neither half can
 * land without the other.
 */
@Injectable()
export class UnitOfWork {
  constructor(private readonly prisma: PrismaService) {}

  async write<T>(fn: (tx: TransactionClient, audit: AuditRecorder) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const audit = new AuditRecorder(tx)
      const result = await fn(tx, audit)

      if (audit.count === 0) throw new MissingAuditTrailError()

      return result
    })
  }

  /**
   * Read-only work. Deliberately separate and deliberately named: reaching for
   * this to avoid the audit requirement is then a visible choice in the diff,
   * not an oversight.
   *
   * Note that some reads MUST still be audited -- FR-X-008 rule 2 lists
   * evidence downloads, opening Terbatas/Rahasia documents, report exports and
   * every AUDITOR_EXT access. Those go through `write`.
   */
  async read<T>(fn: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(fn)
  }
}
