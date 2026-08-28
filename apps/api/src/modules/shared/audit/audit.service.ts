import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'

export interface ChainVerification {
  readonly verifiedFrom: bigint
  readonly verifiedTo: bigint
  readonly isValid: boolean
  readonly brokenAt: bigint | null
  readonly rowsChecked: bigint
}

/**
 * Chain integrity verification (FR-X-008 rule 5).
 *
 * The recomputation lives in `verify_audit_chain` in the database, not here, so
 * that the same `sigap_audit_hash` definition is used to write and to check.
 * A second implementation in TypeScript would be a second thing to keep in
 * step, and the day the two disagree the chain reports tampering that did not
 * happen -- or misses tampering that did.
 *
 * Known limit, documented in ADR-04: this detects modification and removal in
 * the MIDDLE of the chain, but not truncation of its most recent end. Nothing
 * inside the database can, because the anchor would be truncated too. ADR-04
 * calls for the chain head to be copied to log storage outside the database;
 * until that exists, tail truncation is undetectable here.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async verifyChain(fromId = 1n, toId = 9223372036854775807n): Promise<ChainVerification> {
    const rows = await this.prisma.$queryRaw<
      { verified_from: bigint; verified_to: bigint; is_valid: boolean; broken_at: bigint | null; rows_checked: bigint }[]
    >`SELECT * FROM public.verify_audit_chain(${fromId}, ${toId})`

    const row = rows[0]
    if (!row) throw new Error('verify_audit_chain tidak mengembalikan baris.')

    return {
      verifiedFrom: row.verified_from,
      verifiedTo: row.verified_to,
      isValid: row.is_valid,
      brokenAt: row.broken_at,
      rowsChecked: row.rows_checked,
    }
  }
}
