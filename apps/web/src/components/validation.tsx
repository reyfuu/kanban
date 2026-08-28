/**
 * Live validation hints.
 *
 * These exist to replace the most common way a required-length field gets
 * implemented: a submit button that is silently disabled until the text is long
 * enough. That pattern is not a validation message, it is the absence of one.
 * The user sees a dead control, no reason, and no way to find out what is
 * wrong -- and on a touch screen they cannot even hover for a tooltip.
 *
 * The rule lives here rather than beside each button so the same minimum is not
 * re-typed at four call sites and slowly diverging from the server's.
 */

/**
 * The server-side minimum for a recorded reason.
 *
 * Ten characters is not arbitrary: FR-B-020 and FR-C-005 aturan 3 require a
 * recorded rationale, and a two-character "ok" is a rationale in form only.
 * The API enforces this too; this constant exists so the interface can tell
 * people the rule before they hit it, not so it can decide anything.
 */
export const MIN_REASON_LENGTH = 10

export function isReasonComplete(text: string): boolean {
  return text.trim().length >= MIN_REASON_LENGTH
}

/**
 * A live counter under a required-reason field.
 *
 * Reports what is still needed while the text is too short, then confirms it is
 * sufficient. `aria-live="polite"` so a screen-reader user hears the change
 * without being interrupted mid-word; a silent hint would leave exactly the
 * person who most needs it in the dark.
 */
export function ReasonHint(props: { value: string; label?: string }) {
  const length = props.value.trim().length
  const remaining = MIN_REASON_LENGTH - length
  const label = props.label ?? 'Alasan'

  return (
    <p
      aria-live="polite"
      className={`text-xs ${remaining > 0 ? 'text-sg-neutral-600' : 'text-sg-success-700'}`}
    >
      {remaining > 0
        ? `${label} wajib diisi minimal ${MIN_REASON_LENGTH} karakter — kurang ${remaining}.`
        : `${label} sudah memenuhi syarat.`}
    </p>
  )
}
