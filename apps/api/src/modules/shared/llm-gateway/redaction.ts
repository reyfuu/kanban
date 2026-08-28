/**
 * FR-C-015 · redaction of sensitive patterns before anything leaves.
 *
 * The FRD names the patterns: national ID (NIK), bank account, securities
 * account, identity card, phone number, personal email, payment card, and money
 * amounts adjacent to a person's name.
 *
 * Two design points carry the weight.
 *
 * FIRST, values are REPLACED WITH A TYPE MARKER, never deleted (rule 1). A
 * sentence with a hole in it changes meaning; a sentence saying
 * "[NOMOR REKENING]" still reads as a sentence about an account number, so the
 * model can still answer the question without ever seeing the number.
 *
 * SECOND, a redaction failure ABORTS the send (rule 2). This is stated as an
 * exception rather than a fallback on purpose: the tempting behaviour when a
 * regex throws is to pass the text through unmodified, and that turns the one
 * safety step into a no-op precisely in the case where something unexpected was
 * in the text.
 */

export const REDACTION_MARKERS = {
  NIK: '[NIK]',
  REKENING_BANK: '[NOMOR REKENING BANK]',
  REKENING_EFEK: '[NOMOR REKENING EFEK]',
  KARTU_IDENTITAS: '[NOMOR KARTU IDENTITAS]',
  TELEPON: '[NOMOR TELEPON]',
  SUREL: '[ALAMAT SUREL]',
  KARTU_BAYAR: '[NOMOR KARTU PEMBAYARAN]',
  NOMINAL: '[NOMINAL]',
} as const

export class RedactionFailedError extends Error {
  constructor(cause: unknown) {
    super(`Redaksi gagal, pengiriman dibatalkan: ${String(cause)}`)
    this.name = 'RedactionFailedError'
  }
}

interface Rule {
  readonly name: keyof typeof REDACTION_MARKERS
  readonly pattern: RegExp
}

/*
 * Order matters. The most specific patterns run first, because a 16-digit
 * payment card also matches a looser "long run of digits" rule, and whichever
 * runs first decides which marker the reader sees. Getting that backwards does
 * not leak the number, but it does mislabel it, and a compliance reviewer
 * reading the log would draw the wrong conclusion about what was sent.
 */
const RULES: readonly Rule[] = [
  // NIK: exactly 16 digits, optionally spaced in groups. Checked before the
  // payment-card rule because both are 16 digits; NIK is the narrower meaning
  // in an Indonesian securities firm's documents.
  { name: 'NIK', pattern: /\b\d{16}\b/g },

  // Securities account: the local convention is a short alphabetic house code
  // followed by digits, e.g. "TRIM0012345".
  { name: 'REKENING_EFEK', pattern: /\b[A-Z]{2,5}\d{6,12}\b/g },

  // Bank accounts: 10-15 plain digits.
  //
  // Ordered BEFORE payment cards, which was the opposite of my first attempt.
  // A 13-digit bank account also satisfies the card rule's 13-19 digit range,
  // so with cards first every bank account was labelled "[NOMOR KARTU
  // PEMBAYARAN]". The number was still redacted -- nothing leaked -- but a
  // compliance reviewer reading the gateway log would have concluded that card
  // numbers were flowing through a system that never handles them. A control
  // that misdescribes what it caught sends its reader after the wrong problem.
  { name: 'REKENING_BANK', pattern: /\b\d{10,15}\b/g },

  // Payment cards: 16-19 digits, or grouped in fours with spaces/hyphens. The
  // grouped form is what distinguishes a card from a long account number once
  // the plain-digit range above has had its turn.
  { name: 'KARTU_BAYAR', pattern: /\b(?:\d{4}[ -]){3}\d{1,7}\b|\b\d{16,19}\b/g },

  // Indonesian phone numbers, +62 or leading zero.
  { name: 'TELEPON', pattern: /(?:\+62|\b0)8\d{1,2}[- ]?\d{3,4}[- ]?\d{3,5}\b/g },

  // Email addresses.
  { name: 'SUREL', pattern: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },

  // Identity card numbers other than NIK (SIM, paspor): a letter-prefixed code.
  { name: 'KARTU_IDENTITAS', pattern: /\b[A-Z]{1,2}\d{7,9}\b/g },

  // Money amounts. Only redacted when adjacent to a personal name, per the FRD
  // -- an unqualified rupiah figure in a policy is not personal data, and
  // redacting every number would make the answer useless.
  {
    name: 'NOMINAL',
    pattern:
      /\b(?:Bapak|Ibu|Sdr\.?|Sdri\.?|Tuan|Nyonya)\s+[A-Z][\w']+(?:\s+[A-Z][\w']+)*\D{0,40}?(Rp\.?\s?[\d.,]+)/g,
  },
]

export interface RedactionResult {
  readonly text: string
  /** Which rules actually fired, for the gateway log (FR-C-016). */
  readonly applied: readonly string[]
}

/**
 * Redact one string.
 *
 * Throws `RedactionFailedError` rather than returning the input on failure.
 * FR-C-015 rule 2 requires the send to be cancelled, and returning the
 * unredacted text would do the exact opposite.
 */
export function redactForExternal(input: string): RedactionResult {
  try {
    let text = input
    const applied: string[] = []

    for (const rule of RULES) {
      const marker = REDACTION_MARKERS[rule.name]
      // A fresh regex per call: /g regexes carry lastIndex, and a shared one
      // silently skips matches on every second string it is used against.
      const re = new RegExp(rule.pattern.source, rule.pattern.flags)

      if (rule.name === 'NOMINAL') {
        // Only the amount is replaced, not the name that qualified it, so the
        // sentence still says who it was about.
        const next = text.replace(re, (whole, amount: string) =>
          whole.replace(amount, marker),
        )
        if (next !== text) applied.push(rule.name)
        text = next
        continue
      }

      const next = text.replace(re, marker)
      if (next !== text) applied.push(rule.name)
      text = next
    }

    return { text, applied }
  } catch (error) {
    throw new RedactionFailedError(error)
  }
}

/** Redact many strings, failing the whole batch if any one fails. */
export function redactAll(inputs: readonly string[]): RedactionResult[] {
  return inputs.map((i) => redactForExternal(i))
}
