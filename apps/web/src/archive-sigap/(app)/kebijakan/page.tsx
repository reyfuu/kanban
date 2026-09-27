import { notFound } from 'next/navigation'
import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, EmptyState, PageHeader, StatusBadge, type BadgeTone } from '@/components/ui'
import { PartialFailureNotice } from '@/components/feedback'
import { SearchForm } from './search-form'

/**
 * Pusat Kebijakan — L-2x, the search-first face of Modul C.
 *
 * Search is the whole screen, not a control on it. FR-C-009 and the BRD's
 * OBJ-08 both assume the same thing: nobody browses a policy library, they
 * arrive with a question. So the query box is the first and largest element,
 * results are one column of readable citations rather than a dense table, and
 * filters sit beside the results with their counts (FR-C-011).
 *
 * Everything on this page is already entitlement-filtered by the API, inside
 * the database (FR-C-010). Nothing here filters again -- a second filter in the
 * UI would be a second place to get it wrong, and would make the screen look
 * like the control when it is not.
 */

interface SearchHit {
  document_id: string
  document_no: string | null
  title: string
  document_type: string
  process_area: string
  classification: string
  status: string
  version_major: number
  version_minor: number
  effective_from: string | null
  section_ref: string | null
  snippet: string
  score: number
}

interface Facet {
  value: string
  count: number
}

interface SearchResponse {
  results: SearchHit[]
  facets: { documentType: Facet[]; processArea: Facet[] }
  suggestions?: { document_id: string; title: string; process_area: string }[]
  empty_guidance?: string
}

const TYPE_LABEL: Record<string, string> = {
  KEBIJAKAN: 'Kebijakan',
  PEDOMAN: 'Pedoman',
  SOP: 'SOP',
  INSTRUKSI_KERJA: 'Instruksi Kerja',
  SURAT_EDARAN: 'Surat Edaran',
  MEMO_INTERNAL: 'Memo Internal',
  FORMULIR: 'Formulir',
  LAMPIRAN_TEKNIS: 'Lampiran Teknis',
}

const AREA_LABEL: Record<string, string> = {
  DEALING: 'Dealing',
  SETTLEMENT: 'Settlement',
  KUSTODIAN: 'Kustodian',
  RISET: 'Riset',
  PEMASARAN: 'Pemasaran',
  KEUANGAN_AKUNTANSI: 'Keuangan & Akuntansi',
  SDM: 'SDM',
  TI: 'TI',
  KEPATUHAN: 'Kepatuhan',
  MANAJEMEN_RISIKO: 'Manajemen Risiko',
  AUDIT_INTERNAL: 'Audit Internal',
  UMUM: 'Umum',
}

/**
 * FR-X-018 · classification is shown on every result, not hidden in the detail
 * view. Someone about to forward an SOP needs to see "Terbatas" before they act,
 * not after.
 */
const CLASSIFICATION_TONE: Record<string, BadgeTone> = {
  PUBLIK: 'muted',
  INTERNAL: 'neutral',
  TERBATAS: 'warning',
  RAHASIA: 'danger',
}

const STATUS_TONE: Record<string, BadgeTone> = {
  BERLAKU: 'success',
  DIGANTIKAN: 'muted',
  DITARIK: 'danger',
}

export default async function KebijakanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const user = await requireUser()
  if (!hasPermission(user, 'document:read')) notFound()

  const params = await searchParams
  const q = typeof params.q === 'string' ? params.q.trim() : ''
  const documentType = typeof params.jenis === 'string' ? params.jenis : ''
  const processArea = typeof params.bidang === 'string' ? params.bidang : ''
  const auditMode = params.mode === 'audit'

  const canUseAuditMode = ['AUDITOR_INT', 'AUDIT_LEAD', 'COMPLIANCE'].some((r) =>
    user.roles.includes(r),
  )

  let response: SearchResponse | null = null
  let failed = false
  if (q !== '') {
    const query = new URLSearchParams({ q })
    if (documentType) query.set('document_type', documentType)
    if (processArea) query.set('process_area', processArea)
    if (auditMode && canUseAuditMode) query.set('audit_mode', 'true')
    try {
      response = await apiFetch<SearchResponse>(`/documents/search?${query.toString()}`)
    } catch {
      // Distinguished from "no results" on purpose: a failed search that reads
      // as an empty corpus makes someone conclude the SOP does not exist.
      failed = true
    }
  }

  return (
    <div>
      <PageHeader
        title="Pusat Kebijakan"
        description="Cari kebijakan, pedoman, SOP, dan instruksi kerja yang berlaku. Hasil sudah disaring menurut hak akses Anda; dokumen yang tidak boleh Anda akses tidak muncul dalam bentuk apa pun."
      />

      <div className="mt-6">
        <SearchForm
          initialQuery={q}
          initialType={documentType}
          initialArea={processArea}
          auditMode={auditMode}
          canUseAuditMode={canUseAuditMode}
          typeOptions={Object.entries(TYPE_LABEL).map(([value, label]) => ({ value, label }))}
          areaOptions={Object.entries(AREA_LABEL).map(([value, label]) => ({ value, label }))}
        />
      </div>

      {auditMode && canUseAuditMode && (
        <p className="mt-4 rounded-lg border border-sg-info-500 bg-sg-info-50 px-3 py-2 text-sm text-sg-info-700">
          Mode audit aktif: dokumen berstatus Digantikan dan Ditarik ikut ditampilkan. Pengaktifan
          mode ini tercatat pada jejak audit.
        </p>
      )}

      {failed && (
        <div className="mt-4">
          <PartialFailureNotice>
            Pencarian gagal dijalankan. Ini bukan berarti tidak ada dokumen yang cocok — coba lagi
            sebentar lagi.
          </PartialFailureNotice>
        </div>
      )}

      {q === '' && (
        <div className="mt-6">
          <EmptyState>
            Ketik pertanyaan atau istilah pada kolom di atas, misalnya “batas transaksi harian” atau
            “prosedur penyelesaian T+2”.
          </EmptyState>
        </div>
      )}

      {response && (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
          <div>
            {response.results.length === 0 ? (
              <div className="space-y-4">
                <EmptyState>{response.empty_guidance}</EmptyState>
                {response.suggestions && response.suggestions.length > 0 && (
                  <section>
                    <h2 className="text-sm font-semibold text-sg-neutral-900">
                      Mungkin yang Anda maksud
                    </h2>
                    <ul className="mt-2 divide-y divide-sg-neutral-100 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
                      {response.suggestions.map((s) => (
                        <li key={s.document_id}>
                          <Link
                            href={`/kebijakan/${s.document_id}`}
                            className="flex min-h-11 items-center justify-between gap-3 px-4 py-2 text-sm text-sg-accent-700 hover:bg-sg-neutral-50"
                          >
                            <span>{s.title}</span>
                            <span className="text-xs uppercase tracking-wide text-sg-neutral-500">
                              {AREA_LABEL[s.process_area] ?? s.process_area}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            ) : (
              <ol className="space-y-3">
                {response.results.map((hit) => (
                  <li
                    key={`${hit.document_id}-${hit.section_ref ?? ''}`}
                    className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone="neutral">
                        {TYPE_LABEL[hit.document_type] ?? hit.document_type}
                      </StatusBadge>
                      <StatusBadge tone={CLASSIFICATION_TONE[hit.classification] ?? 'neutral'}>
                        {hit.classification}
                      </StatusBadge>
                      {hit.status !== 'BERLAKU' && (
                        <StatusBadge tone={STATUS_TONE[hit.status] ?? 'muted'}>
                          {hit.status}
                        </StatusBadge>
                      )}
                    </div>

                    <h2 className="mt-2 text-md font-semibold text-sg-neutral-900">
                      <Link
                        href={`/kebijakan/${hit.document_id}`}
                        className="hover:text-sg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600"
                      >
                        {hit.title}
                      </Link>
                    </h2>

                    {/* The citation line. FR-C-013 hangs on this being exact,
                        so the section reference is shown next to the version
                        rather than buried in the detail page. */}
                    <p className="mt-1 text-xs text-sg-neutral-500">
                      {hit.document_no && (
                        <>
                          <Code>{hit.document_no}</Code>
                          <span className="mx-2">·</span>
                        </>
                      )}
                      versi {hit.version_major}.{hit.version_minor}
                      {hit.section_ref && (
                        <>
                          <span className="mx-2">·</span>
                          {hit.section_ref}
                        </>
                      )}
                      {hit.effective_from && (
                        <>
                          <span className="mx-2">·</span>
                          berlaku {formatDate(hit.effective_from)}
                        </>
                      )}
                    </p>

                    <p className="mt-2 line-clamp-3 text-sm text-sg-neutral-700">{hit.snippet}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* FR-C-011 · every filter shows the number of results it would give,
              counted AFTER entitlement filtering. */}
          <aside className="space-y-5">
            <FacetList
              title="Jenis dokumen"
              param="jenis"
              current={documentType}
              q={q}
              items={response.facets.documentType}
              labels={TYPE_LABEL}
            />
            <FacetList
              title="Bidang proses"
              param="bidang"
              current={processArea}
              q={q}
              items={response.facets.processArea}
              labels={AREA_LABEL}
            />
          </aside>
        </div>
      )}
    </div>
  )
}

function FacetList(props: {
  title: string
  param: string
  current: string
  q: string
  items: Facet[]
  labels: Record<string, string>
}) {
  if (props.items.length === 0) return null
  return (
    <section>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-sg-neutral-500">
        {props.title}
      </h2>
      <ul className="mt-2 space-y-0.5">
        {props.items
          .slice()
          .sort((a, b) => b.count - a.count)
          .map((f) => {
            const active = props.current === f.value
            const query = new URLSearchParams({ q: props.q })
            if (!active) query.set(props.param, f.value)
            return (
              <li key={f.value}>
                <Link
                  href={`/kebijakan?${query.toString()}`}
                  aria-current={active ? 'true' : undefined}
                  className={
                    active
                      ? 'flex min-h-11 items-center justify-between gap-2 rounded-md bg-sg-accent-50 px-3 text-sm font-medium text-sg-accent-700'
                      : 'flex min-h-11 items-center justify-between gap-2 rounded-md px-3 text-sm text-sg-neutral-700 hover:bg-sg-neutral-100'
                  }
                >
                  <span>{props.labels[f.value] ?? f.value}</span>
                  <span className="tabular-nums text-sg-neutral-500">{f.count}</span>
                </Link>
              </li>
            )
          })}
      </ul>
    </section>
  )
}
