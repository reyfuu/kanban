import { notFound } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, PageHeader, StatusBadge } from '@/components/ui'

/**
 * FR-C-006 aturan 3 · side-by-side comparison of two versions.
 *
 * Rendered as a single unified column rather than two panes. A two-pane view
 * looks more thorough and reads worse: the eye has to match lines across a gap,
 * and the interesting case (one clause replaced by another) is exactly where
 * that matching is hardest. One column with markers puts the old and new text
 * of a changed clause on adjacent lines.
 *
 * The "tampak redaksional" hint is shown but never enforced. FR-C-006 aturan 1
 * makes substantive-versus-editorial a judgement about meaning, and no line
 * count can make that judgement -- the number exists to put the scale of the
 * change in front of the approver, not to decide for them.
 */

interface DiffLine {
  kind: 'sama' | 'tambah' | 'hapus'
  oldLine: number | null
  newLine: number | null
  text: string
}

interface Comparison {
  from: { id: string; version: string; status: string; change_summary: string; effective_from: string | null }
  to: { id: string; version: string; status: string; change_summary: string; effective_from: string | null }
  summary: { added: number; removed: number; unchanged: number; looksEditorial: boolean }
  hunks: { skippedBefore: number; lines: DiffLine[] }[]
}

export default async function BandingkanPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  if (!hasPermission(user, 'document:read')) notFound()

  const { id } = await params
  const query = await searchParams
  const dari = typeof query.dari === 'string' ? query.dari : ''
  const ke = typeof query.ke === 'string' ? query.ke : ''
  if (!dari || !ke) notFound()

  let diff: Comparison
  try {
    diff = await apiFetch<Comparison>(
      `/documents/${id}/bandingkan?dari=${encodeURIComponent(dari)}&ke=${encodeURIComponent(ke)}`,
    )
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  return (
    <div>
      <PageHeader
        title={`Perbandingan versi ${diff.from.version} → ${diff.to.version}`}
        description="Baris yang ditandai merah dihapus, hijau ditambahkan. Bagian yang tidak berubah dipadatkan."
        action={
          <Link
            href={`/kebijakan/${id}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-4 text-sm font-medium text-sg-neutral-700 hover:bg-sg-neutral-50"
          >
            Kembali ke dokumen
          </Link>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge tone="danger">−{diff.summary.removed} baris</StatusBadge>
        <StatusBadge tone="success">+{diff.summary.added} baris</StatusBadge>
        <StatusBadge tone={diff.summary.looksEditorial ? 'muted' : 'warning'}>
          {diff.summary.looksEditorial ? 'Tampak redaksional' : 'Perubahan substansial'}
        </StatusBadge>
      </div>

      {!diff.summary.looksEditorial && (
        <p className="mt-3 rounded-lg border border-sg-warning-500 bg-sg-warning-50 px-3 py-2 text-sm text-sg-warning-700">
          Perubahan sebesar ini biasanya bukan perbaikan redaksional. Bila versi ini diajukan
          sebagai perubahan minor, pertimbangkan kembali: perubahan minor dapat melewati sebagian
          jenjang pengesahan.
        </p>
      )}

      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <VersionCard label="Versi lama" v={diff.from} />
        <VersionCard label="Versi baru" v={diff.to} />
      </dl>

      <section className="mt-6 overflow-hidden rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
        <h2 className="sr-only">Rincian perubahan</h2>
        {diff.hunks.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-sg-neutral-600">
            Tidak ada perbedaan isi antara kedua versi ini.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {diff.hunks.map((hunk, hi) => (
              <div key={hi}>
                {hunk.skippedBefore > 0 && (
                  <p className="border-y border-sg-neutral-200 bg-sg-neutral-50 px-4 py-1 text-2xs uppercase tracking-wider text-sg-neutral-500">
                    {hunk.skippedBefore} baris tidak berubah
                  </p>
                )}
                {hunk.lines.map((line, li) => (
                  <DiffRow key={`${hi}-${li}`} line={line} />
                ))}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

function DiffRow({ line }: { line: DiffLine }) {
  const tone =
    line.kind === 'tambah'
      ? 'bg-sg-success-50 text-sg-success-700'
      : line.kind === 'hapus'
        ? 'bg-sg-danger-50 text-sg-danger-700'
        : 'text-sg-neutral-700'
  const marker = line.kind === 'tambah' ? '+' : line.kind === 'hapus' ? '−' : ' '

  return (
    <div className={`flex items-start gap-3 px-4 py-0.5 font-mono text-xs ${tone}`}>
      {/* Line numbers from both versions, so a reader can cite a change by
          position in either document. */}
      <span className="w-8 shrink-0 select-none text-right tabular-nums text-sg-neutral-400">
        {line.oldLine ?? ''}
      </span>
      <span className="w-8 shrink-0 select-none text-right tabular-nums text-sg-neutral-400">
        {line.newLine ?? ''}
      </span>
      {/* The marker is not the only signal: colour alone would fail WCAG for a
          reader who cannot distinguish red from green. */}
      <span aria-hidden className="w-3 shrink-0 select-none font-semibold">
        {marker}
      </span>
      <span className="whitespace-pre-wrap break-words">{line.text || '\u00a0'}</span>
    </div>
  )
}

function VersionCard({
  label,
  v,
}: {
  label: string
  v: Comparison['from']
}) {
  return (
    <div className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4">
      <dt className="text-2xs font-semibold uppercase tracking-wider text-sg-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 flex flex-wrap items-center gap-2">
        <Code className="text-sm font-medium text-sg-neutral-900">{v.version}</Code>
        <StatusBadge tone="neutral">{v.status}</StatusBadge>
        {v.effective_from && (
          <span className="text-xs text-sg-neutral-500">berlaku {formatDate(v.effective_from)}</span>
        )}
      </dd>
      <p className="mt-2 text-sm text-sg-neutral-700">{v.change_summary}</p>
    </div>
  )
}
