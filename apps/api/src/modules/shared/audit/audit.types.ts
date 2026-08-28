/**
 * One audited action (FR-X-008 rule 1).
 *
 * Actor, roles, session, request id and IP are not part of this shape: they
 * come from the request context, so a caller cannot supply an actor other than
 * the one that is actually authenticated.
 */
export interface AuditEntry {
  /** Verb, e.g. `MASUK`, `UBAH_PERAN`, `PUTUSKAN_REVIEW`. */
  readonly action: string
  readonly objectType: string
  readonly objectId: string
  /** Redacted before storage -- never pass a value you have pre-masked. */
  readonly before?: unknown
  readonly after?: unknown
}

/** Raised when a write transaction ends without recording anything. */
export class MissingAuditTrailError extends Error {
  constructor() {
    super(
      'Transaksi tulis berakhir tanpa jejak audit (FR-X-008). ' +
        'Transaksi dibatalkan: tidak ada aksi tanpa jejak.',
    )
    this.name = 'MissingAuditTrailError'
  }
}

/** Raised when no authenticated actor is in scope for a write. */
export class MissingActorError extends Error {
  constructor() {
    super('Operasi tulis tanpa aktor terautentikasi. Transaksi dibatalkan.')
    this.name = 'MissingActorError'
  }
}
