/**
 * Structure-aware chunking (docs/04-TRD.md Sec 4.1).
 *
 * Why not fixed-length windows: FR-C-013 requires an answer to cite the exact
 * article it came from. A fixed 500-token window cuts Pasal 12 in half and
 * produces a citation that points at the wrong rule -- worse than no answer,
 * because it looks authoritative.
 *
 * So the primary boundary is the structure of an Indonesian normative document:
 * BAB, Pasal, and numbered points. An article that exceeds the budget is split
 * on paragraph boundaries with an overlap, and each chunk keeps a
 * human-readable `sectionRef` plus a context line naming the document and its
 * section path, so a chunk retrieved on its own still knows where it lives.
 */

export interface Chunk {
  readonly index: number
  readonly sectionRef: string | null
  /** The chunk text, prefixed with its context line. */
  readonly content: string
  readonly tokenCount: number
}

/** 04-TRD Sec 4.1 butir 2. */
const MAX_TOKENS = 1_000
const OVERLAP_TOKENS = 100

/**
 * Token count is approximated by whitespace-separated words. A real tokenizer
 * belongs to the embedding model, and this runs before one is chosen; the
 * approximation is only used to decide where to split, where being ~20% off
 * costs nothing. It is deliberately not presented as exact.
 */
function approximateTokens(text: string): number {
  return text.split(/\s+/).filter(Boolean).length
}

/**
 * Headings of Indonesian normative documents. Ordered from broadest to
 * narrowest so a BAB line does not get matched as a numbered point.
 */
const HEADING_PATTERNS: readonly { kind: string; re: RegExp }[] = [
  { kind: 'BAB', re: /^\s*BAB\s+([IVXLCDM]+|\d+)\b\.?\s*(.*)$/i },
  { kind: 'BAGIAN', re: /^\s*BAGIAN\s+(\S+)\b\.?\s*(.*)$/i },
  { kind: 'PASAL', re: /^\s*PASAL\s+(\d+)\b\.?\s*(.*)$/i },
]

interface Heading {
  readonly kind: string
  readonly label: string
}

function matchHeading(line: string): Heading | null {
  for (const { kind, re } of HEADING_PATTERNS) {
    const m = re.exec(line)
    if (m) {
      const number = m[1] ?? ''
      const title = (m[2] ?? '').trim()
      const label = title ? `${titleCase(kind)} ${number} ${title}` : `${titleCase(kind)} ${number}`
      return { kind, label: label.trim() }
    }
  }
  return null
}

function titleCase(kind: string): string {
  return kind.charAt(0) + kind.slice(1).toLowerCase()
}

/**
 * A readable section path, e.g. "Bab III · Pasal 12". Only one heading of each
 * kind is kept, and a broader heading resets the narrower ones below it, which
 * is what makes the path describe where the reader actually is.
 */
function sectionPath(stack: Map<string, string>): string | null {
  const parts = [stack.get('BAB'), stack.get('BAGIAN'), stack.get('PASAL')].filter(
    (p): p is string => p !== undefined,
  )
  return parts.length > 0 ? parts.join(' · ') : null
}

/**
 * Split `text` into structure-aware chunks.
 *
 * `documentTitle` is prepended to every chunk as a context line (04-TRD Sec 4.1
 * butir 4): semantic retrieval reads a chunk in isolation, and a paragraph that
 * says "batas transaksi adalah 5 miliar" means something different depending on
 * which policy it came from.
 */
export function chunkDocument(documentTitle: string, text: string): Chunk[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  const chunks: Chunk[] = []
  const headings = new Map<string, string>()

  let buffer: string[] = []
  let bufferRef: string | null = null

  const flush = () => {
    const body = buffer.join('\n').trim()
    buffer = []
    if (body === '') return
    for (const piece of splitOversized(body)) {
      chunks.push(makeChunk(chunks.length, documentTitle, bufferRef, piece))
    }
  }

  for (const line of lines) {
    const heading = matchHeading(line)
    if (heading) {
      // A heading closes the previous section. Flush before updating the stack
      // so the flushed text keeps the reference it was written under.
      flush()
      if (heading.kind === 'BAB') {
        headings.clear()
      } else if (heading.kind === 'BAGIAN') {
        headings.delete('PASAL')
      }
      headings.set(heading.kind, heading.label)
      bufferRef = sectionPath(headings)
      buffer.push(line.trim())
      continue
    }
    buffer.push(line)
  }
  flush()

  // A document with no recognisable structure still has to be searchable, so
  // it is chunked purely by size rather than being dropped.
  if (chunks.length === 0 && text.trim() !== '') {
    for (const piece of splitOversized(text.trim())) {
      chunks.push(makeChunk(chunks.length, documentTitle, null, piece))
    }
  }

  return chunks
}

function makeChunk(
  index: number,
  documentTitle: string,
  sectionRef: string | null,
  body: string,
): Chunk {
  const contextLine = sectionRef ? `${documentTitle} — ${sectionRef}` : documentTitle
  const content = `${contextLine}\n${body}`
  return { index, sectionRef, content, tokenCount: approximateTokens(content) }
}

/**
 * 04-TRD Sec 4.1 butir 2 · an article longer than the budget is split on
 * paragraph boundaries, with an overlap so a rule that straddles the seam is
 * still retrievable from both sides.
 */
function splitOversized(body: string): string[] {
  if (approximateTokens(body) <= MAX_TOKENS) return [body]

  const paragraphs = body.split(/\n\s*\n/)
  const pieces: string[] = []
  let current: string[] = []
  let currentTokens = 0

  for (const paragraph of paragraphs) {
    const tokens = approximateTokens(paragraph)
    if (currentTokens + tokens > MAX_TOKENS && current.length > 0) {
      pieces.push(current.join('\n\n'))
      const tail = overlapTail(current)
      current = tail ? [tail] : []
      currentTokens = tail ? approximateTokens(tail) : 0
    }
    current.push(paragraph)
    currentTokens += tokens
  }
  if (current.length > 0) pieces.push(current.join('\n\n'))

  // A single paragraph over the budget cannot be split on paragraph
  // boundaries. Rather than emit something over the limit, fall back to a word
  // window -- rare in practice, and still better than dropping the text.
  return pieces.flatMap((piece) =>
    approximateTokens(piece) <= MAX_TOKENS ? [piece] : splitByWords(piece),
  )
}

/** The last ~OVERLAP_TOKENS words of the previous piece. */
function overlapTail(current: readonly string[]): string | null {
  const last = current[current.length - 1]
  if (last === undefined) return null
  const words = last.split(/\s+/).filter(Boolean)
  if (words.length <= OVERLAP_TOKENS) return last
  return words.slice(-OVERLAP_TOKENS).join(' ')
}

function splitByWords(text: string): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const out: string[] = []
  const step = MAX_TOKENS - OVERLAP_TOKENS
  for (let i = 0; i < words.length; i += step) {
    out.push(words.slice(i, i + MAX_TOKENS).join(' '))
    if (i + MAX_TOKENS >= words.length) break
  }
  return out
}
