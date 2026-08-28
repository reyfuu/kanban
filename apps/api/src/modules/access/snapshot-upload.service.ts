import { createHash, randomUUID } from 'node:crypto'
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common'
import { applicationScope, PrismaService, UnitOfWork, type Principal } from '../shared/index.js'
import {
  buildErrorFile,
  buildTemplate,
  FileFormatError,
  validateRows,
  type RowIssue,
} from './snapshot-csv.js'
import {
  SnapshotStagingStore,
  type StagedRow,
  type StagedUpload,
  type StagedWarning,
} from './snapshot-staging.store.js'

/** FR-B-004 aturan 6. */
export const ROW_COUNT_DROP_THRESHOLD = 0.3
/** Guards the request body, not the business rule. Roughly 30 MB of CSV. */
export const MAX_UPLOAD_BYTES = 30 * 1024 * 1024

export interface UploadedFile {
  readonly originalname: string
  readonly size: number
  readonly buffer: Buffer
}

export interface ValidationPreview {
  readonly validationId: string
  readonly totalRows: number
  readonly validRows: number
  readonly invalidRows: number
  readonly warnings: readonly StagedWarning[]
  readonly issues: readonly RowIssue[]
  readonly expiresAt: Date
  readonly mapping: { mapped: number; unowned: number }
}

export interface CommitInput {
  readonly validationId: string
  readonly skipInvalidRows: boolean
  readonly confirmWarnings: readonly string[]
  readonly confirmationNote?: string
}

/**
 * Manual access-data ingestion (FR-B-004, FR-B-005, FR-B-006).
 *
 * Two calls, on purpose. Validation writes nothing and tells the author
 * exactly what the file will do; commit writes an immutable snapshot. The
 * split is what FR-B-004 aturan 3 asks for, and it is also what makes aturan 6
 * possible: a 34% drop in row count can only be a question if there is a point
 * at which the answer still changes the outcome.
 *
 * Nothing in here can amend an existing snapshot. FR-B-005 aturan 2 makes
 * correction a matter of capturing again, so the only write this service
 * performs is an insert of a new snapshot and its lines.
 */
@Injectable()
export class SnapshotUploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
    private readonly staging: SnapshotStagingStore,
  ) {}

  /** FR-B-004 aturan 1 · the per-application template. */
  async template(principal: Principal, applicationId: string): Promise<{ fileName: string; body: string }> {
    const application = await this.requireApplication(principal, applicationId)
    const entitlements = await this.prisma.entitlementCatalog.findMany({
      where: { applicationId },
      select: { technicalCode: true },
      orderBy: { technicalCode: 'asc' },
    })

    return {
      fileName: `templat-akses-${application.code.toLowerCase()}.csv`,
      body: buildTemplate(entitlements.map((e) => e.technicalCode)),
    }
  }

  /**
   * FR-B-004 aturan 3 · validate, count, warn — and write nothing.
   *
   * The mapping cascade runs here too, even though nothing is stored yet, so
   * that the count of accounts nobody owns is visible while the author can
   * still fix their export. Discovering forty ownerless accounts after the
   * snapshot exists means discovering them as forty review items routed to a
   * fallback reviewer.
   */
  async validate(
    principal: Principal,
    applicationId: string,
    file: UploadedFile,
  ): Promise<ValidationPreview> {
    await this.requireApplication(principal, applicationId)

    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(
        `Berkas melebihi batas ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`,
      )
    }
    if (/\.xlsx?$/i.test(file.originalname)) {
      // Said plainly rather than failing as a parse error on binary content.
      throw new BadRequestException(
        'Berkas XLSX belum didukung. Simpan sebagai CSV (UTF-8) lalu unggah ulang.',
      )
    }

    const entitlements = await this.prisma.entitlementCatalog.findMany({
      where: { applicationId },
      select: { id: true, technicalCode: true },
    })
    const codes = new Set(entitlements.map((e) => e.technicalCode.toUpperCase()))

    let parsed
    try {
      parsed = validateRows(file.buffer.toString('utf8'), { knownEntitlementCodes: codes })
    } catch (error) {
      if (error instanceof FileFormatError) throw new BadRequestException(error.message)
      throw error
    }

    const rows: StagedRow[] = parsed.rows.map((r) => ({
      row: r.row,
      accountId: r.accountId,
      accountName: r.accountName,
      entitlementCode: r.entitlementCode,
      accountStatus: r.accountStatus,
      employeeNumber: r.employeeNumber,
      displayName: r.displayName,
      email: r.email,
      lastAccessAt: r.lastAccessAt?.toISOString() ?? null,
      grantedAt: r.grantedAt?.toISOString() ?? null,
      grantedBy: r.grantedBy,
    }))

    const warnings = await this.warningsFor(applicationId, rows.length)
    const mapping = await this.resolveEmployees(rows)

    const staged: StagedUpload = {
      applicationId,
      userId: principal.userId,
      fileName: file.originalname,
      totalRows: parsed.totalRows,
      rows,
      issues: parsed.issues,
      warnings,
    }
    const { validationId, expiresAt } = await this.staging.put(staged)

    return {
      validationId,
      totalRows: parsed.totalRows,
      validRows: rows.length,
      invalidRows: parsed.totalRows - rows.length,
      warnings,
      issues: parsed.issues,
      expiresAt,
      mapping: {
        mapped: [...mapping.values()].filter((id) => id !== null).length,
        unowned: [...mapping.values()].filter((id) => id === null).length,
      },
    }
  }

  /** FR-B-004 aturan 4 · the rejected rows, back out with their reasons. */
  async errorFile(principal: Principal, validationId: string): Promise<{ fileName: string; body: string }> {
    const staged = await this.requireStaged(principal, validationId)
    return {
      fileName: `kesalahan-unggahan-${validationId.slice(0, 8)}.csv`,
      body: buildErrorFile(staged.issues),
    }
  }

  /**
   * FR-B-004 aturan 4, 5 and 6 · turn a validated upload into a snapshot.
   *
   * Three refusals before anything is written, and each corresponds to a way
   * an author could otherwise be surprised by what landed:
   *
   * - invalid rows present without `skip_invalid_rows` — they might have
   *   believed the whole file went in;
   * - a warning marked `requires_confirmation` left unconfirmed — aturan 6
   *   exists precisely so a truncated export cannot enter quietly;
   * - a validation belonging to someone else — the confirmation note is signed
   *   with the committer's name, so the person confirming must be the person
   *   who saw the numbers.
   */
  async commit(principal: Principal, input: CommitInput): Promise<{ snapshotId: string; lineCount: number }> {
    const staged = await this.requireStaged(principal, input.validationId)
    await this.requireApplication(principal, staged.applicationId)

    if (staged.issues.length > 0 && !input.skipInvalidRows) {
      throw new UnprocessableEntityException(
        `Unggahan memuat ${staged.issues.length} baris bermasalah. ` +
          'Perbaiki berkas lalu validasi ulang, atau lanjutkan hanya dengan baris yang sah.',
      )
    }
    if (staged.rows.length === 0) {
      throw new UnprocessableEntityException('Tidak ada baris sah untuk disimpan.')
    }

    const unconfirmed = staged.warnings
      .filter((w) => w.requiresConfirmation)
      .filter((w) => !input.confirmWarnings.includes(w.code))
    if (unconfirmed.length > 0) {
      throw new UnprocessableEntityException(
        `Peringatan berikut harus dikonfirmasi secara eksplisit sebelum menyimpan: ${unconfirmed
          .map((w) => w.code)
          .join(', ')}.`,
      )
    }

    const entitlements = await this.prisma.entitlementCatalog.findMany({
      where: { applicationId: staged.applicationId },
      select: { id: true, technicalCode: true },
    })
    const entitlementIds = new Map(entitlements.map((e) => [e.technicalCode.toUpperCase(), e.id]))
    const employeeIds = await this.resolveEmployees(staged.rows)

    // One capture instant for the whole snapshot. It is also the partition key
    // of every line (migration Sec 7), so it is fixed once here rather than
    // read from the clock per row.
    const capturedAt = new Date()
    const snapshotId = randomUUID()

    const lines = staged.rows.map((row) => ({
      id: randomUUID(),
      snapshotId,
      capturedAt,
      accountId: row.accountId,
      accountName: row.accountName,
      entitlementId: entitlementIds.get(row.entitlementCode)!,
      employeeId: employeeIds.get(this.mappingKey(row)) ?? null,
      accountStatus: row.accountStatus,
      lastAccessAt: row.lastAccessAt ? new Date(row.lastAccessAt) : null,
      grantedAt: row.grantedAt ? new Date(row.grantedAt) : null,
      grantedBy: row.grantedBy,
    }))

    await this.uow.write(async (tx, audit) => {
      await tx.accessSnapshot.create({
        data: {
          id: snapshotId,
          applicationId: staged.applicationId,
          capturedAt,
          // FR-B-004 aturan 5 -- the manual origin is part of the record, and
          // `capturedBy` names who stands behind it.
          source: 'MANUAL',
          capturedBy: principal.userId,
          identityCount: new Set(staged.rows.map((r) => r.accountId)).size,
          entitlementCount: staged.rows.length,
          contentHash: contentHash(staged.rows),
          // Created SELESAI, not MEMPROSES: the rows land in this same
          // transaction, so there is no window in which the snapshot exists
          // while its lines do not. K-1 verification and campaign scoping both
          // read only SELESAI, and a half-written snapshot they could read is
          // exactly the false "the access is gone" they must never see.
          status: 'SELESAI',
        },
      })

      await tx.snapshotLine.createMany({ data: lines })

      await audit.record({
        action: 'UNGGAH_SNAPSHOT',
        objectType: 'ACCESS_SNAPSHOT',
        objectId: snapshotId,
        after: {
          application_id: staged.applicationId,
          source: 'MANUAL',
          file_name: staged.fileName,
          captured_at: capturedAt.toISOString(),
          total_rows: staged.totalRows,
          stored_rows: lines.length,
          skipped_rows: staged.totalRows - lines.length,
          // FR-B-004 aturan 6: the confirmation and its reason are the whole
          // value of the rule. Recorded on the snapshot so the question "who
          // waved through a 34% drop, and why" has an answer later.
          confirmed_warnings: input.confirmWarnings,
          confirmation_note: input.confirmationNote ?? null,
          unowned_accounts: lines.filter((l) => l.employeeId === null).length,
        },
      })
    })

    await this.staging.drop(input.validationId)
    return { snapshotId, lineCount: lines.length }
  }

  /**
   * FR-B-004 aturan 6 · a drop of more than 30% is a question, not a fact.
   *
   * The comparison is against the previous SELESAI snapshot for the same
   * application. An incomplete export is by far the most likely explanation
   * for rows disappearing in bulk, and accepting it silently removes that
   * access from every future review -- which is the same shape of failure as
   * never having collected it.
   */
  private async warningsFor(applicationId: string, rowCount: number): Promise<StagedWarning[]> {
    const previous = await this.prisma.accessSnapshot.findFirst({
      where: { applicationId, status: 'SELESAI' },
      orderBy: { capturedAt: 'desc' },
      select: { entitlementCount: true, capturedAt: true },
    })
    if (!previous || previous.entitlementCount === 0) return []

    const drop = (previous.entitlementCount - rowCount) / previous.entitlementCount
    if (drop <= ROW_COUNT_DROP_THRESHOLD) return []

    return [
      {
        code: 'ROW_COUNT_DROP',
        severity: 'TINGGI',
        message:
          `Jumlah baris turun ${Math.round(drop * 100)}% dibanding snapshot sebelumnya ` +
          `(${previous.entitlementCount} baris, ${previous.capturedAt.toISOString().slice(0, 10)}). ` +
          'Periksa kelengkapan ekspor sebelum melanjutkan.',
        requiresConfirmation: true,
      },
    ]
  }

  /**
   * FR-B-006 aturan 1 and 4 · account to employee, in order, deterministically.
   *
   * Employee number, then email, then an account name equal to the person's
   * directory account. What is deliberately absent is aturan 1's fourth step,
   * name similarity: aturan 2 requires a human to confirm those before they
   * count, and there is nowhere yet to record that confirmation. A similarity
   * guess applied without it would attach one person's access to another
   * person's review — silently, and with the reviewer having no way to see it
   * was a guess. Unmatched accounts become Tanpa Pemilik (aturan 4), which
   * AN-02 is defined to surface.
   */
  private async resolveEmployees(rows: readonly StagedRow[]): Promise<Map<string, string | null>> {
    const numbers = unique(rows.map((r) => r.employeeNumber))
    const emails = unique(rows.map((r) => r.email?.toLowerCase() ?? null))
    const accountNames = unique(rows.map((r) => r.accountName || null))

    const [byNumber, byEmail, byExternalId] = await Promise.all([
      numbers.length === 0
        ? []
        : this.prisma.employee.findMany({
            where: { employeeNumber: { in: numbers } },
            select: { id: true, employeeNumber: true },
          }),
      emails.length === 0
        ? []
        : this.prisma.employee.findMany({
            where: { email: { in: emails, mode: 'insensitive' } },
            select: { id: true, email: true },
          }),
      accountNames.length === 0
        ? []
        : this.prisma.appUser.findMany({
            where: { externalId: { in: accountNames }, employeeId: { not: null } },
            select: { externalId: true, employeeId: true },
          }),
    ])

    const numberIndex = new Map(byNumber.map((e) => [e.employeeNumber, e.id]))
    const emailIndex = new Map<string, string>()
    for (const employee of byEmail) {
      const key = employee.email.toLowerCase()
      // `employee.email` carries no UNIQUE constraint (it follows the ERD).
      // An address held by two people identifies neither, so an ambiguous
      // match resolves to nobody rather than to whoever sorted first.
      emailIndex.set(key, emailIndex.has(key) ? '' : employee.id)
    }
    const externalIdIndex = new Map(byExternalId.map((u) => [u.externalId, u.employeeId!]))

    const resolved = new Map<string, string | null>()
    for (const row of rows) {
      const key = this.mappingKey(row)
      if (resolved.has(key)) continue

      const match =
        (row.employeeNumber ? numberIndex.get(row.employeeNumber) : undefined) ??
        (row.email ? emailIndex.get(row.email.toLowerCase()) || undefined : undefined) ??
        (row.accountName ? externalIdIndex.get(row.accountName) : undefined) ??
        null

      resolved.set(key, match)
    }
    return resolved
  }

  /** Identity of an account within one upload — mapping is per account, not per row. */
  private mappingKey(row: StagedRow): string {
    return `${row.accountId} ${row.employeeNumber ?? ''} ${row.email ?? ''} ${row.accountName}`
  }

  private async requireStaged(principal: Principal, validationId: string): Promise<StagedUpload> {
    const staged = await this.staging.get(validationId)
    if (!staged) {
      throw new NotFoundException(
        'Validasi tidak ditemukan atau sudah kedaluwarsa. Unggah dan validasi ulang berkasnya.',
      )
    }
    if (staged.userId !== principal.userId) {
      // 404 rather than 403: the existence of someone else's staged upload is
      // not this caller's to learn (CLAUDE.md rule 3).
      throw new NotFoundException('Validasi tidak ditemukan atau sudah kedaluwarsa.')
    }
    return staged
  }

  private async requireApplication(principal: Principal, applicationId: string) {
    const scope = applicationScope(principal)
    const application = await this.prisma.application.findFirst({
      where: { AND: [scope.whereOn('id'), { id: applicationId }] },
      select: { id: true, code: true, name: true },
    })
    if (!application) throw new NotFoundException('Aplikasi tidak ditemukan.')
    return application
  }
}

/**
 * FR-B-005 aturan 1 · a fingerprint of the content, not of the upload.
 *
 * Sorted before hashing so that the same access, exported in a different order,
 * fingerprints the same. Otherwise every re-export looks like a change and the
 * fingerprint answers no question worth asking.
 */
function contentHash(rows: readonly StagedRow[]): string {
  const canonical = rows
    .map((r) => `${r.accountId}|${r.entitlementCode}|${r.accountStatus}`)
    .sort()
    .join('\n')
  return createHash('sha256').update(canonical).digest('hex')
}

function unique(values: readonly (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => v !== null && v !== ''))]
}
