'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { formatDaysAgo, formatNumber } from '@/lib/format'
import type { ApplicationRow } from '../../aplikasi/page'
import { createCampaign, launchCampaign, previewCampaign, type CampaignPreview } from './actions'

/** FR-B-009, explained in human language rather than by rule code (L-09 step 2). */
const REVIEWER_RULES = [
  { code: 'RA-01', label: 'Atasan langsung', help: 'Item diarahkan ke atasan pemilik akun. Cocok bila pertanyaannya "apakah orang ini masih perlu akses ini".' },
  { code: 'RA-02', label: 'Pemilik aplikasi', help: 'Seluruh item satu aplikasi diarahkan ke pemiliknya. Cocok bila pertanyaannya "siapa saja yang boleh ada di aplikasi ini".' },
  { code: 'RA-03', label: 'Dua lapis', help: 'Atasan langsung menelaah lebih dulu, lalu pemilik aplikasi. Lebih lambat, dan lebih sulit disetujui asal-asalan.' },
  { code: 'RA-04', label: 'Pemilik hak akses', help: 'Belum tersedia: katalog hak akses belum menyimpan pemiliknya. Seluruh item akan jatuh ke reviewer cadangan.' },
  { code: 'RA-05', label: 'Reviewer khusus', help: 'Satu orang meninjau seluruh cakupan. Hanya untuk kampanye ad-hoc yang sempit.' },
] as const

const STEPS = ['Cakupan', 'Reviewer', 'Jadwal', 'Pratinjau'] as const

interface UserOption {
  id: string
  full_name: string
}

/**
 * Screen L-09 · the four-step campaign wizard.
 *
 * Step 4 is the one that matters. FR-B-008 rule 2 requires the author to see
 * item count, reviewer count and load distribution BEFORE launching, and L-09
 * rule 3 explains why the distribution is there: uneven reviewer load is the
 * main reason campaigns miss their deadline, and it is invisible until someone
 * computes it.
 *
 * Blockers and warnings are rendered as two distinct things. A blocker disables
 * launch and says what must happen; a warning is shown prominently and lets the
 * author proceed, which is L-09 rules 1 and 2. Collapsing them into one list
 * would either block on things that should not block, or let a stale snapshot
 * through as "just a warning".
 */
export function CampaignWizard(props: { applications: ApplicationRow[]; reviewers: UserOption[] }) {
  const router = useRouter()
  const [step, setStep] = useState(0)

  const [name, setName] = useState('')
  const [campaignType, setCampaignType] = useState('PERIODIK')
  const [selectedApps, setSelectedApps] = useState<Set<string>>(new Set())
  const [reviewerRule, setReviewerRule] = useState<string | null>(null)
  const [fallbackUserId, setFallbackUserId] = useState('')
  const [startDate, setStartDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  const [campaignId, setCampaignId] = useState<string | null>(null)
  const [campaignCode, setCampaignCode] = useState<string | null>(null)
  const [preview, setPreview] = useState<CampaignPreview | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canLeaveScope = name.trim().length >= 5 && selectedApps.size > 0
  // No default rule is preselected: the choice determines who reviews what, and
  // a default here would be accepted as readily as a default decision would.
  const canLeaveReviewer = reviewerRule !== null && fallbackUserId !== ''
  const canLeaveSchedule = startDate !== '' && dueDate !== '' && dueDate >= startDate

  async function goToPreview() {
    setBusy(true)
    setError(null)

    const created = await createCampaign({
      name: name.trim(),
      campaignType,
      applicationIds: [...selectedApps],
      reviewerRule: reviewerRule!,
      fallbackReviewerUserId: fallbackUserId,
      startDate,
      dueDate,
    })
    if (!created.ok) {
      setBusy(false)
      setError(created.message)
      return
    }
    setCampaignId(created.id)
    setCampaignCode(created.code)

    const previewed = await previewCampaign(created.id)
    setBusy(false)
    if (!previewed.ok) {
      setError(previewed.message)
      return
    }
    setPreview(previewed.preview)
    setStep(3)
  }

  async function launch() {
    if (!campaignId) return
    setBusy(true)
    setError(null)

    const result = await launchCampaign(campaignId)
    setBusy(false)
    if (!result.ok) {
      setError(result.message)
      return
    }
    router.push('/kampanye')
    router.refresh()
  }

  return (
    <div>
      <h1 className="text-xl font-semibold text-sg-neutral-900">Susun Kampanye Review</h1>

      <ol className="mt-4 flex flex-wrap gap-2" aria-label="Langkah penyusunan">
        {STEPS.map((label, index) => (
          <li key={label}>
            <span
              aria-current={index === step ? 'step' : undefined}
              className={
                index === step
                  ? 'rounded-md border border-sg-accent-600 bg-sg-accent-50 px-3 py-1.5 text-sm font-medium text-sg-accent-700'
                  : index < step
                    ? 'rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-1.5 text-sm text-sg-neutral-600'
                    : 'rounded-md border border-dashed border-sg-neutral-300 px-3 py-1.5 text-sm text-sg-neutral-400'
              }
            >
              {index + 1}. {label}
            </span>
          </li>
        ))}
      </ol>

      {error && (
        <p role="alert" className="mt-4 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
          {error}
        </p>
      )}

      <div className="mt-5 rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-5">
        {step === 0 && (
          <div>
            <label htmlFor="nama" className="block text-sm font-medium text-sg-neutral-900">
              Nama kampanye
            </label>
            <input
              id="nama"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Review Hak Akses Semester I 2027"
              className="mt-1 w-full max-w-lg rounded-md border border-sg-neutral-300 px-3 py-2 text-sm focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
            />

            <fieldset className="mt-4">
              <legend className="text-sm font-medium text-sg-neutral-900">Jenis</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {['PERIODIK', 'AD_HOC', 'PEMICU_PERISTIWA'].map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm text-sg-neutral-800">
                    <input
                      type="radio"
                      name="jenis"
                      checked={campaignType === t}
                      onChange={() => setCampaignType(t)}
                      className="accent-sg-accent-600"
                    />
                    {t}
                  </label>
                ))}
              </div>
            </fieldset>

            <h2 className="mt-5 text-sm font-medium text-sg-neutral-900">Aplikasi dalam cakupan</h2>
            <p className="mt-1 text-xs text-sg-neutral-600">
              Umur snapshot ditampilkan di samping tiap aplikasi. Snapshot yang lebih tua dari 7 hari
              menghalangi peluncuran (FR-B-008).
            </p>
            <ul className="mt-2 divide-y divide-sg-neutral-100 rounded-md border border-sg-neutral-200">
              {props.applications.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <label className="flex items-center gap-3 text-sm text-sg-neutral-800">
                    <input
                      type="checkbox"
                      checked={selectedApps.has(a.id)}
                      onChange={() =>
                        setSelectedApps((cur) => {
                          const next = new Set(cur)
                          if (next.has(a.id)) next.delete(a.id)
                          else next.add(a.id)
                          return next
                        })
                      }
                      className="h-4 w-4 accent-sg-accent-600"
                    />
                    <span>
                      {a.name}
                      <span className="ml-2 text-xs text-sg-neutral-500">{a.code}</span>
                    </span>
                  </label>
                  <span
                    className={`whitespace-nowrap text-xs ${
                      a.snapshot_is_stale ? 'text-sg-danger-700' : 'text-sg-neutral-600'
                    }`}
                  >
                    {a.latest_snapshot
                      ? `snapshot ${formatDaysAgo(a.latest_snapshot.age_days)}`
                      : 'belum ada snapshot'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 1 && (
          <div>
            <fieldset>
              <legend className="text-sm font-medium text-sg-neutral-900">Aturan penugasan reviewer</legend>
              <div className="mt-2 space-y-2">
                {REVIEWER_RULES.map((r) => (
                  <label
                    key={r.code}
                    className="flex cursor-pointer gap-3 rounded-md border border-sg-neutral-200 p-3 text-sm hover:bg-sg-neutral-50"
                  >
                    <input
                      type="radio"
                      name="aturan"
                      checked={reviewerRule === r.code}
                      onChange={() => setReviewerRule(r.code)}
                      className="mt-0.5 accent-sg-accent-600"
                    />
                    <span>
                      <span className="font-medium text-sg-neutral-900">{r.label}</span>
                      <span className="ml-2 text-xs text-sg-neutral-500">{r.code}</span>
                      {/* L-09 step 2: the explanation in human language, not the
                          rule code on its own. */}
                      <span className="mt-0.5 block text-sg-neutral-600">{r.help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="mt-5">
              <label htmlFor="cadangan" className="block text-sm font-medium text-sg-neutral-900">
                Reviewer cadangan <span className="font-normal text-sg-danger-700">(wajib)</span>
              </label>
              <p className="mt-1 text-xs text-sg-neutral-600">
                Item yang tidak dapat ditentukan reviewernya jatuh ke sini (FR-B-009 aturan 1).
              </p>
              <select
                id="cadangan"
                value={fallbackUserId}
                onChange={(e) => setFallbackUserId(e.target.value)}
                className="mt-1 w-full max-w-sm rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
              >
                <option value="">— pilih —</option>
                {props.reviewers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-wrap gap-6">
            <div>
              <label htmlFor="mulai" className="block text-sm font-medium text-sg-neutral-900">
                Tanggal mulai
              </label>
              <input
                id="mulai"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1 rounded-md border border-sg-neutral-300 px-3 py-2 text-sm focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
              />
            </div>
            <div>
              <label htmlFor="tenggat" className="block text-sm font-medium text-sg-neutral-900">
                Tenggat
              </label>
              <input
                id="tenggat"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="mt-1 rounded-md border border-sg-neutral-300 px-3 py-2 text-sm focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600"
              />
            </div>
          </div>
        )}

        {step === 3 && preview && (
          <div>
            <p className="text-sm text-sg-neutral-600">
              Kampanye <span className="font-medium text-sg-neutral-900">{campaignCode}</span> tersimpan
              sebagai draf. Belum ada item yang diarahkan ke siapa pun sampai Anda meluncurkannya.
            </p>

            <p className="mt-3 text-base font-semibold text-sg-neutral-900">
              {formatNumber(preview.item_count)} item review · {formatNumber(preview.reviewer_count)}{' '}
              reviewer · {formatNumber(preview.application_count)} aplikasi
            </p>

            <h2 className="mt-4 text-sm font-medium text-sg-neutral-900">Sebaran beban reviewer</h2>
            <p className="mt-1 text-sm text-sg-neutral-700 tabular-nums">
              Terendah {formatNumber(preview.reviewer_load.lowest)} item · Median{' '}
              {formatNumber(preview.reviewer_load.median)} item · Tertinggi{' '}
              {formatNumber(preview.reviewer_load.highest)} item
            </p>
            {preview.reviewer_load.heaviest_reviewer && (
              <p className="mt-1 text-sm text-sg-neutral-600">
                Terberat: {preview.reviewer_load.heaviest_reviewer.full_name} (
                {formatNumber(preview.reviewer_load.heaviest_reviewer.item_count)} item)
              </p>
            )}

            {preview.warnings.length > 0 && (
              <section className="mt-4">
                <h2 className="text-sm font-medium text-sg-neutral-900">Perlu perhatian</h2>
                <ul className="mt-2 space-y-1 rounded-md border border-sg-warning-500 bg-sg-warning-50 px-3 py-2 text-sm text-sg-warning-700">
                  {preview.warnings.map((w) => (
                    <li key={w.code}>{w.message}</li>
                  ))}
                </ul>
              </section>
            )}

            {preview.blockers.length > 0 && (
              <section className="mt-4">
                <h2 className="text-sm font-medium text-sg-danger-700">Penghalang peluncuran</h2>
                <ul className="mt-2 space-y-1 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
                  {preview.blockers.map((b) => (
                    <li key={b.code + (b.applicationId ?? '')}>{b.message}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex justify-between gap-3">
        <button
          type="button"
          disabled={step === 0 || busy || step === 3}
          onClick={() => setStep((s) => s - 1)}
          className="rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-4 py-2 text-sm text-sg-neutral-800 hover:bg-sg-neutral-50 disabled:opacity-50"
        >
          ← Kembali
        </button>

        {step < 2 && (
          <button
            type="button"
            disabled={busy || (step === 0 ? !canLeaveScope : !canLeaveReviewer)}
            onClick={() => setStep((s) => s + 1)}
            className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:opacity-60"
          >
            Lanjut →
          </button>
        )}

        {step === 2 && (
          <button
            type="button"
            disabled={busy || !canLeaveSchedule}
            onClick={() => void goToPreview()}
            className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:opacity-60"
          >
            {busy ? 'Menghitung…' : 'Lihat pratinjau →'}
          </button>
        )}

        {step === 3 && (
          <button
            type="button"
            // L-09 rule 1: disabled while a blocker stands. The blocker list
            // above says what has to happen, so the disabled button is never
            // the only thing the author is told.
            disabled={busy || !preview?.can_launch}
            onClick={() => void launch()}
            className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:opacity-60"
          >
            {busy ? 'Meluncurkan…' : 'Luncurkan Kampanye'}
          </button>
        )}
      </div>
    </div>
  )
}
