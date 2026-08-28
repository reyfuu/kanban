import type { Classification } from '@prisma/client'

/**
 * FR-C-014 · the classification gate.
 *
 * ADR-03 names this the most critical control point in the architecture,
 * because the LLM gateway is the only path by which internal data leaves the
 * company's control. Everything here is therefore written as "allow only what
 * is explicitly permitted" rather than "block what is known to be bad": a new
 * classification level added to the enum later must fail closed, not silently
 * become sendable because nobody remembered to add it to a block-list.
 */

/** FR-X-018 · only these two may be processed by an external service. */
const SENDABLE: readonly Classification[] = ['PUBLIK', 'INTERNAL'] as const

export function maySendExternally(classification: Classification): boolean {
  return SENDABLE.includes(classification)
}

export interface Chunk {
  readonly id: string
  readonly documentId: string
  readonly documentTitle: string
  readonly versionLabel: string
  readonly sectionNo: string
  readonly text: string
  readonly classification: Classification
}

export type GateVerdict =
  | {
      readonly outcome: 'DITERUSKAN'
      readonly sendable: readonly Chunk[]
      /** FR-C-014 rule 3 · true when some sources were held back. */
      readonly partial: boolean
      readonly withheld: number
    }
  | {
      readonly outcome: 'DITOLAK_KLASIFIKASI'
      readonly reason: string
      readonly withheld: number
    }

/**
 * Split retrieved chunks into what may leave and what may not.
 *
 * Three outcomes, matching FR-C-014 rules 2 and 3:
 *  - nothing sendable: refuse outright, and say why;
 *  - some sendable: send only those, and flag the answer as partial;
 *  - all sendable: send them all.
 *
 * The middle case is the one that needs care. Sending the low-classification
 * subset without telling the reader that something was held back produces an
 * answer that looks complete and is not -- and a reader who believes they have
 * the whole picture will not go looking for the rest.
 */
export function applyClassificationGate(chunks: readonly Chunk[]): GateVerdict {
  const sendable = chunks.filter((c) => maySendExternally(c.classification))
  const withheld = chunks.length - sendable.length

  if (sendable.length === 0) {
    return {
      outcome: 'DITOLAK_KLASIFIKASI',
      reason:
        'Jawaban otomatis tidak tersedia untuk materi berklasifikasi Terbatas atau Rahasia.',
      withheld,
    }
  }

  return { outcome: 'DITERUSKAN', sendable, partial: withheld > 0, withheld }
}
