/**
 * Date and number formatting (06-DESIGN §9.2 rule 5, CLAUDE.md rule 7).
 *
 * The single place either is done. Not a style preference: this system shows
 * the same timestamp on a screen, in an evidence package and in an audit
 * export, and an auditor comparing them must see the same string. Formatting
 * inline produces three renderings of one moment, and the disagreement surfaces
 * as a question about whether the records match.
 *
 * Everything is Asia/Jakarta and id-ID. Timestamps are stored in UTC
 * (TRD §3.5) and displayed local; pinning the zone here rather than trusting
 * the browser means a reviewer travelling does not see different dates from
 * their colleagues on the same campaign.
 */
const TIME_ZONE = 'Asia/Jakarta'
const LOCALE = 'id-ID'

const dateOnly = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: TIME_ZONE,
})

const dateTimeShort = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: TIME_ZONE,
})

const dateTimePrecise = new Intl.DateTimeFormat(LOCALE, {
  dateStyle: 'medium',
  timeStyle: 'medium',
  timeZone: TIME_ZONE,
})

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

/** An absent value renders as an em dash, never as an empty cell or "null". */
const ABSENT = '—'

export function formatDate(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateOnly.format(date) : ABSENT
}

export function formatDateTime(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateTimeShort.format(date) : ABSENT
}

/** For the audit trail, where the second matters for ordering. */
export function formatDateTimePrecise(value: string | Date | null | undefined): string {
  const date = toDate(value)
  return date ? dateTimePrecise.format(date) : ABSENT
}

export function formatNumber(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? integer.format(value) : ABSENT
}

export function formatPercent(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? `${integer.format(value)}%` : ABSENT
}

/**
 * "2 hari lalu" — relative age, for the "last accessed" column.
 *
 * Rounded to whole days deliberately. "1,7 hari" invites a precision the source
 * data does not have, and the reviewer's question is only ever "recently, or
 * not in years".
 */
export function formatDaysAgo(days: number | null | undefined): string {
  if (typeof days !== 'number' || !Number.isFinite(days)) return ABSENT
  if (days <= 0) return 'hari ini'
  if (days === 1) return 'kemarin'
  if (days < 30) return `${integer.format(days)} hari lalu`
  if (days < 365) return `${integer.format(Math.floor(days / 30))} bulan lalu`
  return `${integer.format(Math.floor(days / 365))} tahun lalu`
}

/** Days until a due date; negative when it has passed. */
export function daysUntil(value: string | Date | null | undefined): number | null {
  const date = toDate(value)
  if (!date) return null
  return Math.ceil((date.getTime() - Date.now()) / 86_400_000)
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export { ABSENT }
