import { notFound } from 'next/navigation'
import Link from 'next/link'
import { apiFetch, ApiError } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, PageHeader, StatusBadge, type BadgeTone } from '@/components/ui'

/**
 * Document detail — the version history is the substance of this page.
 *
 * FR-C-006 keeps every version and FR-C-007 gives each one a force window, and
 * an auditor's question is almost never "what does it say now" but "what did it
 * say in March". So the versions table leads with the force window and the
 * change summary, rather than being a footnote under the current text.
 *
 * A document the reader may not access returns 404 from the API, not 403
 * (kode aturan #3), and this page passes that through unchanged: a 403 would
 * confirm the document exists, which for a Rahasia document is the disclosure
 * itself.
 */

interface DocumentDetail {
  id: string
  documentNo: string | null
  title: string
  documentType: string
  classification: string
  processArea: string
  tags: string[]
  summary: string | null
  status: string
  nextReviewDate: string | null
  ownerEmployee: { fullName: string; jobTitle: string }
  ownerOrgUnit: { code: string; name: string }
  versions: {
    id: string
    versionMajor: number
    versionMinor: number
    status: string
    changeSummary: string
    effectiveFrom: string | null
    effectiveUntil: string | null
    approvedAt: string | null
  }[]
  controlLinks: { id: string; note: string | null; control: { id: string; code: string; title: string } }[]
}

const STATUS_TONE: Record<string, BadgeTone> = {
  DRAF: 'muted',
  DALAM_PENELAAHAN: 'info',
  MENUNGGU_PENGESAHAN: 'info',
  DISAHKAN: 'info',
  BERLAKU: 'success',
  DALAM_REVISI: 'warning',
  DIGANTIKAN: 'muted',
  DITARIK: 'danger',
}

const CLASSIFICATION_TONE: Record<string, BadgeTone> = {
  PUBLIK: 'muted',
  INTERNAL: 'neutral',
  TERBATAS: 'warning',
  RAHASIA: 'danger',
}

export default async function DokumenPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  if (!hasPermission(user, 'document:read')) notFound()

  const { id } = await params

  let doc: DocumentDetail
  try {
    doc = await apiFetch<DocumentDetail>(`/documents/${id}`)
  } catch (error) {
    // 404 covers both "does not exist" and "you may not see it", by design.
    if (error instanceof ApiError && error.status === 404) notFound()
    throw error
  }

  const overdue =
    doc.nextReviewDate !== null && new Date(doc.nextReviewDate) < new Date() && doc.status === 'BERLAKU'

  return (
    <div>
      <PageHeader
        title={doc.title}
        description={doc.summary ?? undefined}
        action={
          <Link
            href="/kebijakan"
            className="inline-flex min-h-11 items-center rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-4 text-sm font-medium text-sg-neutral-700 hover:bg-sg-neutral-50"
          >
            Kembali ke pencarian
          </Link>
        }
      />

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <StatusBadge tone={STATUS_TONE[doc.status] ?? 'neutral'}>{doc.status}</StatusBadge>
        <StatusBadge tone={CLASSIFICATION_TONE[doc.classification] ?? 'neutral'}>
          {doc.classification}
        </StatusBadge>
        {doc.documentNo && <Code className="text-xs text-sg-neutral-600">{doc.documentNo}</Code>}
      </div>

      {/*
       * FR-C-008 aturan 4 · an overdue document stays in force and says so.
       * Presenting it as invalid would push people to ignore a procedure that
       * still binds them, which is more dangerous than the delay itself.
       */}
      {overdue && (
        <p className="mt-4 rounded-lg border border-sg-warning-500 bg-sg-warning-50 px-3 py-2 text-sm text-sg-warning-700">
          Terlambat ditinjau sejak {formatDate(doc.nextReviewDate!)}. Dokumen ini{' '}
          <strong className="font-semibold">tetap berlaku</strong> dan wajib dipatuhi; pemiliknya
          telah tercatat pada dasbor kepatuhan.
        </p>
      )}

      <dl className="mt-6 grid gap-4 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Pemilik dokumen" value={doc.ownerEmployee.fullName} hint={doc.ownerEmployee.jobTitle} />
        <Field label="Unit pemilik" value={doc.ownerOrgUnit.name} hint={doc.ownerOrgUnit.code} />
        <Field label="Bidang proses" value={doc.processArea} />
        <Field
          label="Tinjauan berikutnya"
          value={doc.nextReviewDate ? formatDate(doc.nextReviewDate) : '—'}
        />
      </dl>

      {doc.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {doc.tags.map((t) => (
            <StatusBadge key={t} tone="muted">
              {t}
            </StatusBadge>
          ))}
        </div>
      )}

      <section className="mt-8">
        <h2 className="text-sm font-semibold text-sg-neutral-900">Riwayat versi</h2>
        <p className="mt-1 text-sm text-sg-neutral-600">
          Setiap versi menyimpan jendela berlakunya, sehingga pertanyaan “versi mana yang berlaku
          pada tanggal tertentu” dapat dijawab untuk audit periode lampau.
        </p>

        {/* Below sm the table becomes a list of cards: a nine-column table on a
            phone means scrolling in two directions to read one row. */}
        <ul className="mt-3 space-y-2 sm:hidden">
          {doc.versions.map((v) => (
            <li
              key={v.id}
              className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-3 text-sm"
            >
              <div className="flex items-center justify-between">
                <Code className="font-medium text-sg-neutral-900">
                  {v.versionMajor}.{v.versionMinor}
                </Code>
                <StatusBadge tone={STATUS_TONE[v.status] ?? 'neutral'}>{v.status}</StatusBadge>
              </div>
              <p className="mt-1 text-sg-neutral-600">
                {v.effectiveFrom ? formatDate(v.effectiveFrom) : '—'} s.d.{' '}
                {v.effectiveUntil ? formatDate(v.effectiveUntil) : 'sekarang'}
              </p>
              <p className="mt-1 text-sg-neutral-700">{v.changeSummary}</p>
            </li>
          ))}
        </ul>

        <div className="mt-3 hidden overflow-x-auto rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 sm:block">
          <table className="w-full text-sm">
            <caption className="sr-only">Riwayat versi dokumen</caption>
            <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left">
              <tr>
                <Th>Versi</Th>
                <Th>Status</Th>
                <Th>Berlaku sejak</Th>
                <Th>Berlaku sampai</Th>
                <Th>Ringkasan perubahan</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-neutral-100">
              {doc.versions.map((v) => (
                <tr key={v.id} className="hover:bg-sg-neutral-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Code className="font-medium text-sg-neutral-900">
                      {v.versionMajor}.{v.versionMinor}
                    </Code>
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={STATUS_TONE[v.status] ?? 'neutral'}>{v.status}</StatusBadge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-sg-neutral-700">
                    {v.effectiveFrom ? formatDate(v.effectiveFrom) : '—'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-sg-neutral-700">
                    {v.effectiveUntil ? formatDate(v.effectiveUntil) : 'sekarang'}
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-700">{v.changeSummary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {doc.controlLinks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-sg-neutral-900">Kontrol yang didasari</h2>
          <p className="mt-1 text-sm text-sg-neutral-600">
            Dokumen ini menjadi dasar prosedur bagi kontrol audit berikut (FR-C-022).
          </p>
          <ul className="mt-2 divide-y divide-sg-neutral-100 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
            {doc.controlLinks.map((l) => (
              <li key={l.id} className="px-4 py-2 text-sm">
                <Code className="text-sg-neutral-900">{l.control.code}</Code>
                <span className="ml-2 text-sg-neutral-700">{l.control.title}</span>
                {l.note && <p className="mt-0.5 text-xs text-sg-neutral-500">{l.note}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Field(props: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold uppercase tracking-wider text-sg-neutral-500">
        {props.label}
      </dt>
      <dd className="mt-1 text-sm text-sg-neutral-900">{props.value}</dd>
      {props.hint && <p className="text-xs text-sg-neutral-500">{props.hint}</p>}
    </div>
  )
}

function Th(props: { children: React.ReactNode }) {
  return (
    <th
      scope="col"
      className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-sg-neutral-500"
    >
      {props.children}
    </th>
  )
}
