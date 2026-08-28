import type { DocumentType } from '@prisma/client'

/**
 * The rules of Modul C that are policy, not plumbing -- kept in one file with
 * no dependencies so they can be read, reviewed and tested as rules.
 *
 * Source: docs/03-FRD.md FR-C-001, FR-C-004, FR-C-006, FR-C-008.
 */

/**
 * FR-C-001 aturan 2 · the normative hierarchy.
 *
 * A lower-ranked document may cite a higher-ranked one, never the reverse: an
 * SOP implements a Kebijakan, so a Kebijakan that cites an SOP would make the
 * policy depend on its own implementation detail. Higher number = higher
 * standing.
 *
 * This is a named table rather than the enum's declaration order on purpose.
 * Enum ordering is invisible at the point where the rule is enforced, and a
 * future edit that reorders the enum for readability would silently change a
 * governance rule.
 */
const NORMATIVE_RANK: Record<DocumentType, number> = {
  KEBIJAKAN: 40,
  PEDOMAN: 30,
  SOP: 20,
  INSTRUKSI_KERJA: 10,
  // The remaining types are instruments, not tiers of the hierarchy. They sit
  // outside the ladder and may reference anything; giving them a rank would
  // invent a rule the FRD does not state.
  SURAT_EDARAN: 0,
  MEMO_INTERNAL: 0,
  FORMULIR: 0,
  LAMPIRAN_TEKNIS: 0,
}

/** True when `citing` may reference `cited` under FR-C-001 aturan 2. */
export function mayReference(citing: DocumentType, cited: DocumentType): boolean {
  const from = NORMATIVE_RANK[citing]
  const to = NORMATIVE_RANK[cited]
  // Instruments (rank 0) are outside the ladder in both directions.
  if (from === 0 || to === 0) return true
  return from <= to
}

/**
 * FR-C-008 aturan 1 · default review cycle in months, by type.
 *
 * Surat Edaran follows its own validity period rather than a fixed cycle; it
 * gets 12 months as a floor so it still surfaces on the compliance dashboard
 * if nobody set an end date, rather than never being reviewed at all.
 */
const DEFAULT_REVIEW_CYCLE_MONTHS: Record<DocumentType, number> = {
  KEBIJAKAN: 24,
  PEDOMAN: 12,
  SOP: 12,
  INSTRUKSI_KERJA: 12,
  SURAT_EDARAN: 12,
  MEMO_INTERNAL: 12,
  FORMULIR: 24,
  LAMPIRAN_TEKNIS: 24,
}

export function defaultReviewCycleMonths(type: DocumentType): number {
  return DEFAULT_REVIEW_CYCLE_MONTHS[type]
}

/**
 * FR-C-004 · the lifecycle state machine, transcribed from the diagram.
 *
 * Written as data rather than as a chain of `if` statements so the legal moves
 * can be compared against the diagram line by line. Digantikan and Ditarik are
 * terminal: a superseded or withdrawn document is history, and history does
 * not get edited back into force. A new version is a new row.
 */
export const DOCUMENT_TRANSITIONS: Record<string, readonly string[]> = {
  DRAF: ['DALAM_PENELAAHAN'],
  DALAM_PENELAAHAN: ['DRAF', 'MENUNGGU_PENGESAHAN'],
  MENUNGGU_PENGESAHAN: ['DRAF', 'DISAHKAN'],
  DISAHKAN: ['BERLAKU'],
  BERLAKU: ['DALAM_REVISI', 'DIGANTIKAN', 'DITARIK'],
  DALAM_REVISI: ['DALAM_PENELAAHAN'],
  DIGANTIKAN: [],
  DITARIK: [],
}

export function canTransition(from: string, to: string): boolean {
  return (DOCUMENT_TRANSITIONS[from] ?? []).includes(to)
}

/**
 * FR-C-004 aturan 1 · only Berlaku documents appear in general search.
 *
 * Aturan 5 lets AUDITOR_INT, AUDIT_LEAD and COMPLIANCE see Digantikan and
 * Ditarik through an explicit audit mode. That mode is a deliberate act which
 * FR-C-010 aturan 3 requires to be written to the audit trail, so it is passed
 * in as a flag and never inferred from someone's roles.
 */
export const AUDIT_MODE_ROLES = ['AUDITOR_INT', 'AUDIT_LEAD', 'COMPLIANCE'] as const

export function searchableStatuses(auditMode: boolean): readonly string[] {
  return auditMode ? ['BERLAKU', 'DIGANTIKAN', 'DITARIK'] : ['BERLAKU']
}

/**
 * FR-C-006 aturan 1 · which component of the version number a change bumps.
 * Substantive change = major, editorial = minor.
 */
export function nextVersion(
  current: { major: number; minor: number },
  kind: 'MAYOR' | 'MINOR',
): { major: number; minor: number } {
  return kind === 'MAYOR'
    ? { major: current.major + 1, minor: 0 }
    : { major: current.major, minor: current.minor + 1 }
}

/** FR-C-008 · the next review date, `months` after `from`. */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from)
  d.setMonth(d.getMonth() + months)
  return d
}
