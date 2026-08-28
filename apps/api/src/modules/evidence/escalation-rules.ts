/**
 * FR-A-008 · the reminder and escalation ladder for evidence requests.
 *
 * The ladder is a pure function of "how many days past the deadline is it",
 * separated from the sending so the schedule can be argued about and tested
 * without a database, a clock, or a mail server in the way. The stages come
 * straight from the table in 03-FRD §FR-A-008.
 *
 * The shape that matters is that the audience only ever GROWS: PIC, then PIC
 * plus their manager, then plus the audit lead, then the executive dashboard.
 * An escalation that swapped recipients instead of adding them would quietly
 * stop telling the PIC about their own overdue item at exactly the point the
 * item became a problem, and the person best placed to fix it would be the one
 * person who stopped hearing about it.
 */

export type EscalationAudience =
  | 'PIC'
  | 'PIC_DAN_ATASAN'
  | 'PIC_ATASAN_DAN_KETUA_TIM'
  | 'KRITIS'

export interface EscalationStage {
  /** Days relative to the due date. Negative is before, positive is after. */
  readonly offsetDays: number
  readonly audience: EscalationAudience
  /** The FR-X-011 code this stage sends under. */
  readonly notificationCode: string
  readonly label: string
}

/**
 * Ordered by when they fire. NT-02 is the pre-deadline reminder and NT-03 the
 * missed-deadline escalation, which is why everything from day 0 onward uses
 * NT-03: the matrix marks NT-03 un-summarizable, and every one of these stages
 * is by definition a message about something already late.
 */
export const ESCALATION_LADDER: readonly EscalationStage[] = [
  { offsetDays: -3, audience: 'PIC', notificationCode: 'NT-02', label: 'H-3 sebelum tenggat' },
  { offsetDays: -1, audience: 'PIC', notificationCode: 'NT-02', label: 'H-1 sebelum tenggat' },
  { offsetDays: 0, audience: 'PIC_DAN_ATASAN', notificationCode: 'NT-03', label: 'Tenggat terlewat' },
  {
    offsetDays: 3,
    audience: 'PIC_ATASAN_DAN_KETUA_TIM',
    notificationCode: 'NT-03',
    label: '3 hari setelah tenggat',
  },
  {
    offsetDays: 7,
    audience: 'KRITIS',
    notificationCode: 'NT-03',
    label: '7 hari setelah tenggat — ditandai kritis',
  },
] as const

/**
 * Whole days from `dueDate` to `today`, both taken as calendar dates.
 *
 * Compared as UTC calendar days rather than by subtracting timestamps: a
 * request due "today" must be zero days late for everyone regardless of the
 * hour a scheduled job happens to run, and a millisecond-based difference makes
 * that depend on whether the job runs at 09:00 or 23:00.
 */
export function daysFromDue(dueDate: Date, today: Date): number {
  const a = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate())
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Math.round((b - a) / 86_400_000)
}

/**
 * The stage due exactly today, or null.
 *
 * Exact match, not "at least": each stage fires once, on its own day. A
 * threshold test would re-fire every later day too, and a PIC who receives the
 * same escalation every morning learns to filter escalations.
 */
export function stageFor(dueDate: Date, today: Date): EscalationStage | null {
  const delta = daysFromDue(dueDate, today)
  return ESCALATION_LADDER.find((s) => s.offsetDays === delta) ?? null
}

/** FR-A-008 · at 7 days the item is critical and belongs on the exec dashboard. */
export function isCritical(dueDate: Date, today: Date): boolean {
  return daysFromDue(dueDate, today) >= 7
}
