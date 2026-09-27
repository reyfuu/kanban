'use client'

import { useState } from 'react'
import { Code, StatusBadge } from '@/components/ui'
import { formatDateTime } from '@/lib/format'
import { generateEvidencePackage } from './actions'
import type { EvidencePackage } from './types'

/**
 * FR-B-022 / FR-B-023 · the evidence-package panel on the campaign detail
 * screen, and the visible face of the product's cross-module bridge.
 *
 * Two states. Before a pack exists and the campaign is eligible, it offers to
 * form one; forming it is the act that closes the campaign (FR-B-010), so the
 * button says as much. After a pack exists it shows the frozen eight-section
 * summary, the pack's own fingerprint (§2.5 mono, compared character by
 * character), and the Modul A controls it was auto-linked to -- the bridge made
 * visible.
 *
 * It decides nothing. The API re-checks every precondition and this relays the
 * refusal verbatim ("masih ada N item"), because that refusal tells the person
 * what to finish rather than just that it failed.
 */
export function EvidencePackagePanel(props: {
  campaignId: string
  initialPack: EvidencePackage | null
  canGenerate: boolean
}) {
  const [pack, setPack] = useState<EvidencePackage | null>(props.initialPack)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onGenerate() {
    setBusy(true)
    setError(null)
    const result = await generateEvidencePackage(props.campaignId)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    setPack(result.pack)
  }

  return (
    <section className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-md font-semibold text-sg-neutral-900">
            Paket Bukti Kampanye
            {pack && (
              // Purple is reserved for "system-generated" (§2.0). The pack is
              // exactly that: an immutable, machine-formed piece of evidence.
              <StatusBadge tone="system">Dibangkitkan sistem</StatusBadge>
            )}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-sg-neutral-600">
            Rangkuman lengkap hasil kampanye sebagai satu bukti bersidik jari, otomatis tertaut ke
            kontrol akses periodik pada Modul A (FR-B-022, FR-B-023).
          </p>
        </div>

        {pack === null && props.canGenerate && (
          <button
            type="button"
            onClick={() => void onGenerate()}
            disabled={busy}
            className="whitespace-nowrap rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 shadow-sm transition-colors hover:bg-sg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600 disabled:opacity-60"
          >
            {busy ? 'Membentuk…' : 'Bentuk paket & tutup kampanye'}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700"
        >
          {error}
        </p>
      )}

      {pack === null ? (
        <p className="mt-4 rounded-md border border-dashed border-sg-neutral-300 bg-sg-neutral-50 px-3 py-6 text-center text-sm text-sg-neutral-600">
          {props.canGenerate
            ? 'Paket bukti dibentuk setelah seluruh item diputuskan dan seluruh cakupan ditandatangani. Pembentukannya sekaligus menutup kampanye.'
            : 'Paket bukti belum dibentuk untuk kampanye ini.'}
        </p>
      ) : (
        <FormedPack pack={pack} />
      )}
    </section>
  )
}

function FormedPack({ pack }: { pack: EvidencePackage }) {
  const c = pack.contents
  const rev = c.revocation_status

  return (
    <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Judul">{pack.title}</Field>
        <Field label="Dibentuk">{formatDateTime(pack.generated_at)}</Field>
        <Field label="Sidik jari isi">
          {/* The pack's own fingerprint (FR-B-022 rule 3), full width, mono, so
              it can be compared character by character against a copy. */}
          <Code className="break-all text-xs text-sg-neutral-700">{pack.content_hash}</Code>
        </Field>
        <Field label="Bukti Modul A">
          <Code className="text-xs text-sg-neutral-700">{pack.evidence_id.slice(0, 8)}…</Code>
        </Field>
      </div>

      {/* The eight sections of FR-B-022, as a scannable count grid. */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-sg-neutral-500">
          Isi paket
        </h3>
        <dl className="mt-2 grid grid-cols-2 gap-px overflow-hidden rounded-md border border-sg-neutral-200 bg-sg-neutral-200 sm:grid-cols-4">
          <Stat label="Keputusan" value={c.decision_detail} />
          <Stat label="Sign-off" value={c.signoff_records} />
          <Stat label="Pengecualian" value={c.exceptions} />
          <Stat label="Anomali" value={c.anomalies} />
          <Stat label="Tiket pencabutan" value={rev.total} />
          <Stat label="Terverifikasi tutup" value={rev.verified_closed} tone="success" />
          <Stat label="Gagal / terbuka" value={rev.failed + rev.open} tone={rev.failed + rev.open > 0 ? 'danger' : 'neutral'} />
          <Stat label="Reviewer ditandai" value={c.flagged_reviewers} tone={c.flagged_reviewers > 0 ? 'warning' : 'neutral'} />
        </dl>
      </div>

      {/* FR-B-023 rule 2: the controls this pack was auto-linked to. */}
      <Field label={`Kontrol akses periodik tertaut (${pack.auto_linked_control_ids.length})`}>
        {pack.auto_linked_control_ids.length === 0 ? (
          <span className="text-sm text-sg-neutral-500">Tidak ada kontrol akses periodik aktif.</span>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {pack.auto_linked_control_ids.map((id) => (
              <li key={id}>
                <Code className="rounded bg-sg-neutral-100 px-1.5 py-0.5 text-xs text-sg-neutral-700">
                  {id.slice(0, 8)}…
                </Code>
              </li>
            ))}
          </ul>
        )}
      </Field>

      <p className="text-xs text-sg-neutral-500">
        Format tersedia: {pack.formats.join(', ')}. Berkas PDF/XLSX dibangkitkan oleh proses laporan;
        datanya sudah lengkap di atas.
      </p>
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-sg-neutral-500">
        {props.label}
      </dt>
      <dd className="mt-1 text-sm text-sg-neutral-900">{props.children}</dd>
    </div>
  )
}

function Stat(props: { label: string; value: number; tone?: 'neutral' | 'success' | 'danger' | 'warning' }) {
  const tone = props.tone ?? 'neutral'
  const valueColor =
    tone === 'success'
      ? 'text-sg-success-700'
      : tone === 'danger'
        ? 'text-sg-danger-700'
        : tone === 'warning'
          ? 'text-sg-warning-700'
          : 'text-sg-neutral-900'
  return (
    <div className="bg-sg-neutral-0 px-3 py-2">
      <p className={`text-lg font-semibold tabular-nums ${valueColor}`}>{props.value}</p>
      <p className="text-xs text-sg-neutral-600">{props.label}</p>
    </div>
  )
}
