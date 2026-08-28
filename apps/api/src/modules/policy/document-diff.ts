/**
 * FR-C-006 aturan 3 · comparing two versions of a document.
 *
 * A line-level diff, computed with the classic Myers-style longest-common-
 * subsequence, then reported as ranges of added / removed / unchanged lines.
 *
 * Two decisions worth stating, because both were choices:
 *
 * **Why line-level and not word-level.** Normative documents are read by
 * article, and the question a reviewer actually asks is "which pasal changed".
 * A word diff answers a different question and buries that one in noise; a line
 * diff over a document whose paragraphs are its clauses maps almost exactly
 * onto the structure people already have in their heads.
 *
 * **Why no dependency.** The diff of two revisions of a policy is evidence: it
 * is what a reviewer relies on when they approve "only editorial changes", and
 * FR-C-006 aturan 1 makes that distinction load-bearing for the version number.
 * A dependency here would put a supply-chain surface underneath a governance
 * decision, on an on-premise deployment (ADR: no cloud services), to save about
 * sixty lines. LCS over lines is a solved, testable problem.
 */

export type DiffKind = 'sama' | 'tambah' | 'hapus'

export interface DiffLine {
  readonly kind: DiffKind
  /** 1-based line number in the old version; null for an added line. */
  readonly oldLine: number | null
  /** 1-based line number in the new version; null for a removed line. */
  readonly newLine: number | null
  readonly text: string
}

export interface DiffSummary {
  readonly added: number
  readonly removed: number
  readonly unchanged: number
  /**
   * Whether the change looks purely editorial.
   *
   * A *hint*, never a decision. It exists to catch the common mistake -- a
   * substantive rewrite filed as a minor revision to skip approval tiers -- by
   * putting the numbers in front of the approver. It deliberately does not
   * block anything: FR-C-006 aturan 1 makes "substansi vs redaksional" a
   * judgement about meaning, and no line count can make that judgement. A tool
   * that pretended otherwise would either block legitimate work or bless
   * changes nobody read.
   */
  readonly looksEditorial: boolean
}

export interface DocumentDiff {
  readonly lines: readonly DiffLine[]
  readonly summary: DiffSummary
}

/** Beyond this many changed lines, a revision stops looking editorial. */
const EDITORIAL_LINE_BUDGET = 10

export function diffDocuments(oldText: string, newText: string): DocumentDiff {
  const oldLines = splitLines(oldText)
  const newLines = splitLines(newText)

  const lines = buildDiff(oldLines, newLines)

  let added = 0
  let removed = 0
  let unchanged = 0
  for (const line of lines) {
    if (line.kind === 'tambah') added += 1
    else if (line.kind === 'hapus') removed += 1
    else unchanged += 1
  }

  return {
    lines,
    summary: {
      added,
      removed,
      unchanged,
      looksEditorial: added + removed <= EDITORIAL_LINE_BUDGET,
    },
  }
}

function splitLines(text: string): string[] {
  return text.replace(/\r\n/g, '\n').split('\n')
}

/**
 * Longest common subsequence over lines, as a full DP table.
 *
 * O(n·m) in time and memory. That is fine and deliberate here: FR-C-011's
 * corpus is 500-2000 normative documents, an outlier of which runs a few
 * thousand lines, so the worst realistic table is a few million small integers
 * held for the length of one request. A linear-space variant (Hirschberg) would
 * halve the memory and double the code; the simpler version is the one a
 * reviewer can check against the definition, which matters more for something
 * whose output is treated as evidence.
 */
function buildDiff(a: readonly string[], b: readonly string[]): DiffLine[] {
  const n = a.length
  const m = b.length

  // lcs[i][j] = length of the LCS of a[i..] and b[j..]
  const lcs: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    const row = lcs[i]!
    const next = lcs[i + 1]!
    for (let j = m - 1; j >= 0; j -= 1) {
      row[j] = a[i] === b[j] ? next[j + 1]! + 1 : Math.max(next[j]!, row[j + 1]!)
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ kind: 'sama', oldLine: i + 1, newLine: j + 1, text: a[i]! })
      i += 1
      j += 1
    } else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) {
      out.push({ kind: 'hapus', oldLine: i + 1, newLine: null, text: a[i]! })
      i += 1
    } else {
      out.push({ kind: 'tambah', oldLine: null, newLine: j + 1, text: b[j]! })
      j += 1
    }
  }
  while (i < n) {
    out.push({ kind: 'hapus', oldLine: i + 1, newLine: null, text: a[i]! })
    i += 1
  }
  while (j < m) {
    out.push({ kind: 'tambah', oldLine: null, newLine: j + 1, text: b[j]! })
    j += 1
  }

  return out
}

/**
 * Collapse long stretches of unchanged text, keeping `context` lines either
 * side of every change.
 *
 * A diff of two policy revisions is mostly unchanged text, and an interface
 * that renders all of it hides the four lines that matter. Returned as explicit
 * gap markers rather than by silently dropping lines, so the reader can see
 * that something was omitted and how much.
 */
export interface DiffHunk {
  readonly skippedBefore: number
  readonly lines: readonly DiffLine[]
}

export function collapseUnchanged(lines: readonly DiffLine[], context = 3): DiffHunk[] {
  const keep = new Array<boolean>(lines.length).fill(false)
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i]!.kind === 'sama') continue
    for (let k = Math.max(0, i - context); k <= Math.min(lines.length - 1, i + context); k += 1) {
      keep[k] = true
    }
  }

  const hunks: DiffHunk[] = []
  let current: DiffLine[] = []
  let skipped = 0

  for (let i = 0; i < lines.length; i += 1) {
    if (keep[i]) {
      current.push(lines[i]!)
      continue
    }
    if (current.length > 0) {
      hunks.push({ skippedBefore: skipped, lines: current })
      current = []
      skipped = 0
    }
    skipped += 1
  }
  if (current.length > 0) hunks.push({ skippedBefore: skipped, lines: current })

  return hunks
}
