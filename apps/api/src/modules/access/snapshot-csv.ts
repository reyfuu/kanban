/**
 * Templated access-data files: the template, the parser, and the row rules
 * (FR-B-004 aturan 1 s.d. 4).
 *
 * Deliberately free of Nest, Prisma and I/O. Everything here is a pure
 * function over text, which is what makes the row rules testable without a
 * database -- and the row rules are the part that decides whether an
 * application owner's export becomes review scope or becomes eight red lines.
 */

/** FR-B-004 aturan 2 -- required first, then optional, in template order. */
export const TEMPLATE_COLUMNS = [
  ['account_id', 'Pengenal akun pada aplikasi. Wajib.', 'u-00341'],
  ['account_name', 'Nama akun sebagaimana tertulis di aplikasi. Wajib.', 'rudi.hartono'],
  ['entitlement_code', 'Kode hak akses; harus ada pada katalog aplikasi. Wajib.', 'BO_SETTLE_APPROVE'],
  ['account_status', 'AKTIF atau NONAKTIF. Wajib.', 'AKTIF'],
  ['employee_number', 'Nomor induk karyawan pemilik akun. Opsional.', 'EMP-00287'],
  ['display_name', 'Nama tampilan pada aplikasi. Opsional.', 'Rudi Hartono'],
  ['email', 'Surel yang terdaftar pada akun. Opsional.', 'rudi.hartono@trimegah.co.id'],
  ['last_access_at', 'Waktu akses terakhir, format YYYY-MM-DD. Opsional.', '2026-08-14'],
  ['granted_at', 'Tanggal hak akses diberikan, format YYYY-MM-DD. Opsional.', '2024-03-01'],
  ['granted_by', 'Pihak yang memberikan akses. Opsional.', 'admin.backoffice'],
] as const

const REQUIRED_COLUMNS = ['account_id', 'account_name', 'entitlement_code', 'account_status'] as const
const KNOWN_COLUMNS = new Set(TEMPLATE_COLUMNS.map(([name]) => name) as readonly string[])

export const ACCOUNT_STATUSES = ['AKTIF', 'NONAKTIF'] as const

export interface RowIssue {
  /** 1-based line number in the uploaded file, header included, as the author sees it. */
  readonly row: number
  readonly column: string
  readonly code: string
  readonly message: string
  readonly value: string | null
}

export interface ParsedRow {
  readonly row: number
  readonly accountId: string
  readonly accountName: string
  readonly entitlementCode: string
  readonly accountStatus: string
  readonly employeeNumber: string | null
  readonly displayName: string | null
  readonly email: string | null
  readonly lastAccessAt: Date | null
  readonly grantedAt: Date | null
  readonly grantedBy: string | null
}

export interface ParseResult {
  readonly totalRows: number
  readonly rows: ParsedRow[]
  readonly issues: RowIssue[]
}

/** Raised for problems with the file as a whole -- no row number applies. */
export class FileFormatError extends Error {}

/**
 * FR-B-004 aturan 1 -- one template per application, carrying the entitlement
 * codes that application actually has.
 *
 * The example row uses a real code from the catalogue rather than an invented
 * one, because the most common upload error by far is an entitlement code that
 * does not exist, and a template demonstrating a valid code prevents more of
 * those than any error message afterwards can repair.
 */
export function buildTemplate(entitlementCodes: readonly string[]): string {
  const sample = entitlementCodes[0] ?? 'KODE_HAK_AKSES'
  const header = TEMPLATE_COLUMNS.map(([name]) => name)
  // The description line is prefixed with `#` so an author who fills in the
  // template without deleting the instructions does not turn them into a row.
  const descriptions = TEMPLATE_COLUMNS.map(([, description]) => `# ${description}`)
  const example = TEMPLATE_COLUMNS.map(([name, , value]) =>
    name === 'entitlement_code' ? sample : value,
  )

  return [
    header.map(csvCell).join(','),
    descriptions.map(csvCell).join(','),
    example.map(csvCell).join(','),
    '',
  ].join('\n')
}

/** Serialises rejected rows back out with the reason attached (FR-B-004 aturan 4). */
export function buildErrorFile(issues: readonly RowIssue[]): string {
  const header = ['baris', 'kolom', 'nilai', 'kode', 'keterangan']
  const body = issues.map((issue) =>
    [String(issue.row), issue.column, issue.value ?? '', issue.code, issue.message]
      .map(csvCell)
      .join(','),
  )
  return [header.join(','), ...body, ''].join('\n')
}

/**
 * RFC 4180 with the tolerances real exports need: a UTF-8 byte order mark,
 * CRLF or LF, and semicolon separators -- what Excel writes under an
 * Indonesian locale, and the reason "the file looks fine but every row is
 * invalid" happens.
 */
export function parseDelimited(text: string): { header: string[]; records: string[][] } {
  const clean = text.replace(/^\uFEFF/, '')
  if (clean.trim() === '') throw new FileFormatError('Berkas kosong.')

  const delimiter = detectDelimiter(clean)
  const records: string[][] = []
  let field = ''
  let record: string[] = []
  let quoted = false

  for (let i = 0; i < clean.length; i += 1) {
    const char = clean[i]

    if (quoted) {
      if (char === '"') {
        if (clean[i + 1] === '"') {
          field += '"'
          i += 1
        } else quoted = false
      } else field += char
      continue
    }

    if (char === '"' && field === '') quoted = true
    else if (char === delimiter) {
      record.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && clean[i + 1] === '\n') i += 1
      record.push(field)
      records.push(record)
      field = ''
      record = []
    } else field += char
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    records.push(record)
  }

  const nonEmpty = records.filter((r) => r.some((cell) => cell.trim() !== ''))
  const header = (nonEmpty.shift() ?? []).map((cell) => cell.trim().toLowerCase())

  const missing = REQUIRED_COLUMNS.filter((column) => !header.includes(column))
  if (missing.length > 0) {
    throw new FileFormatError(
      `Kolom wajib tidak ditemukan pada baris tajuk: ${missing.join(', ')}. ` +
        'Unduh templat aplikasi ini dan gunakan tajuknya tanpa diubah.',
    )
  }

  const unknown = header.filter((column) => column !== '' && !KNOWN_COLUMNS.has(column))
  if (unknown.length > 0) {
    throw new FileFormatError(
      `Kolom tidak dikenali: ${unknown.join(', ')}. ` +
        'Hapus kolom tambahan atau gunakan templat aplikasi ini.',
    )
  }

  return { header, records: nonEmpty }
}

export interface RowRuleContext {
  /** Entitlement codes on this application's catalogue, upper-cased. */
  readonly knownEntitlementCodes: ReadonlySet<string>
}

/**
 * Validates every row and keeps the good ones (FR-B-004 aturan 3 and 4).
 *
 * Every row is examined even after the first failure, on purpose. Stopping at
 * the first bad row produces the worst possible loop for an application owner:
 * fix one line, re-upload, wait, discover the next one. The whole point of a
 * pre-upload validation is that it is exhaustive.
 */
export function validateRows(text: string, context: RowRuleContext): ParseResult {
  const { header, records } = parseDelimited(text)
  const index = new Map(header.map((column, i) => [column, i]))

  const rows: ParsedRow[] = []
  const issues: RowIssue[] = []
  const seen = new Map<string, number>()
  let skipped = 0

  records.forEach((record, i) => {
    // +2: one for the header line, one to count from 1 rather than 0.
    const row = i + 2
    const cell = (column: string): string => {
      const at = index.get(column)
      return at === undefined ? '' : (record[at] ?? '').trim()
    }

    // The template's own description line, echoed back by an author who never
    // deleted it. Skipped rather than reported: telling someone their
    // instructions are an invalid row helps nobody.
    if (cell('account_id').startsWith('#')) {
      skipped += 1
      return
    }

    const before = issues.length
    const fail = (column: string, code: string, message: string, value: string | null): void => {
      issues.push({ row, column, code, message, value })
    }

    for (const column of REQUIRED_COLUMNS) {
      if (cell(column) === '') fail(column, 'REQUIRED', 'Kolom wajib tidak boleh kosong.', null)
    }

    const entitlementCode = cell('entitlement_code').toUpperCase()
    if (entitlementCode !== '' && !context.knownEntitlementCodes.has(entitlementCode)) {
      fail(
        'entitlement_code',
        'UNKNOWN_ENTITLEMENT',
        `Kode hak akses "${cell('entitlement_code')}" tidak terdapat pada katalog aplikasi.`,
        cell('entitlement_code'),
      )
    }

    const accountStatus = cell('account_status').toUpperCase()
    if (accountStatus !== '' && !ACCOUNT_STATUSES.includes(accountStatus as 'AKTIF')) {
      fail('account_status', 'INVALID_ENUM', 'Nilai harus AKTIF atau NONAKTIF.', cell('account_status'))
    }

    const lastAccessAt = parseDate(cell('last_access_at'))
    if (lastAccessAt === 'invalid') {
      fail('last_access_at', 'INVALID_DATE', 'Format tanggal harus YYYY-MM-DD.', cell('last_access_at'))
    }
    const grantedAt = parseDate(cell('granted_at'))
    if (grantedAt === 'invalid') {
      fail('granted_at', 'INVALID_DATE', 'Format tanggal harus YYYY-MM-DD.', cell('granted_at'))
    }

    const email = cell('email')
    if (email !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      fail('email', 'INVALID_EMAIL', 'Format surel tidak sah.', email)
    }

    // A duplicate (account, entitlement) pair is one row of access described
    // twice. Reported rather than silently de-duplicated: the counts in the
    // preview have to be the counts the file claims, or the author cannot
    // reconcile them against their own export.
    if (cell('account_id') !== '' && entitlementCode !== '') {
      const key = `${cell('account_id')} ${entitlementCode}`
      const first = seen.get(key)
      if (first !== undefined) {
        fail(
          'account_id',
          'DUPLICATE_ROW',
          `Pasangan akun dan hak akses ini sudah ada pada baris ${first}.`,
          cell('account_id'),
        )
      } else seen.set(key, row)
    }

    if (issues.length !== before) return

    rows.push({
      row,
      accountId: cell('account_id'),
      accountName: cell('account_name'),
      entitlementCode,
      accountStatus,
      employeeNumber: cell('employee_number') || null,
      displayName: cell('display_name') || null,
      email: email || null,
      lastAccessAt: lastAccessAt === 'invalid' ? null : lastAccessAt,
      grantedAt: grantedAt === 'invalid' ? null : grantedAt,
      grantedBy: cell('granted_by') || null,
    })
  })

  return { totalRows: records.length - skipped, rows, issues }
}

function detectDelimiter(text: string): string {
  const end = text.search(/[\r\n]/)
  const firstLine = end === -1 ? text : text.slice(0, end)
  return (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ','
}

function parseDate(value: string): Date | null | 'invalid' {
  if (value === '') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'invalid'
  const parsed = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime())) return 'invalid'
  // Rejects 2026-02-31, which Date would otherwise roll forward into March.
  return parsed.toISOString().slice(0, 10) === value ? parsed : 'invalid'
}

function csvCell(value: string): string {
  return /[",;\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}
