'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

/**
 * The search bar for Pusat Kebijakan.
 *
 * A plain form that pushes the query into the URL rather than fetching from the
 * browser. Three reasons, in order of importance: the API token stays server-
 * side (lib/api.ts), a search becomes a shareable link an auditor can cite, and
 * the back button does what everyone expects.
 *
 * Every control is at least 44px tall. This screen is the one people use from a
 * phone on the trading floor, where the whole question is "what does the SOP
 * actually say".
 */
export function SearchForm(props: {
  initialQuery: string
  initialType: string
  initialArea: string
  auditMode: boolean
  canUseAuditMode: boolean
  typeOptions: { value: string; label: string }[]
  areaOptions: { value: string; label: string }[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [query, setQuery] = useState(props.initialQuery)

  function submit(formData: FormData) {
    const params = new URLSearchParams()
    const q = String(formData.get('q') ?? '').trim()
    if (q) params.set('q', q)
    const jenis = String(formData.get('jenis') ?? '')
    if (jenis) params.set('jenis', jenis)
    const bidang = String(formData.get('bidang') ?? '')
    if (bidang) params.set('bidang', bidang)
    if (formData.get('mode') === 'on') params.set('mode', 'audit')
    router.push(`/kebijakan?${params.toString()}`)
  }

  const hasFilters =
    searchParams.get('jenis') !== null ||
    searchParams.get('bidang') !== null ||
    searchParams.get('mode') !== null

  return (
    <form action={submit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="flex-1">
          <label htmlFor="q" className="sr-only">
            Kata kunci atau pertanyaan
          </label>
          <input
            id="q"
            name="q"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari kebijakan, SOP, atau instruksi kerja…"
            autoComplete="off"
            className="min-h-11 w-full rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-3 text-sm text-sg-neutral-900 outline-none transition-colors placeholder:text-sg-neutral-400 focus:border-tri-navy focus:ring-2 focus:ring-tri-navy/15"
          />
        </div>
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-tri-navy px-5 text-sm font-semibold text-tri-on-primary transition-colors hover:bg-tri-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-navy"
        >
          Cari
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="jenis" className="sr-only">
          Jenis dokumen
        </label>
        <select
          id="jenis"
          name="jenis"
          defaultValue={props.initialType}
          className="min-h-11 rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-3 text-sm text-sg-neutral-800 focus:border-tri-navy focus:outline-none"
        >
          <option value="">Semua jenis</option>
          {props.typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <label htmlFor="bidang" className="sr-only">
          Bidang proses
        </label>
        <select
          id="bidang"
          name="bidang"
          defaultValue={props.initialArea}
          className="min-h-11 rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-3 text-sm text-sg-neutral-800 focus:border-tri-navy focus:outline-none"
        >
          <option value="">Semua bidang</option>
          {props.areaOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        {/*
         * FR-C-010 aturan 3 · audit mode is opt-in and its activation is
         * written to the audit trail. It is a checkbox, never a remembered
         * preference: an auditor doing ordinary work should see the same
         * corpus everyone else sees unless they deliberately said otherwise.
         */}
        {props.canUseAuditMode && (
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-sg-neutral-300 bg-sg-neutral-0 px-3 text-sm text-sg-neutral-700">
            <input
              type="checkbox"
              name="mode"
              defaultChecked={props.auditMode}
              className="h-4 w-4 rounded border-sg-neutral-400 text-sg-accent-600 focus:ring-sg-accent-600"
            />
            Mode audit (termasuk digantikan &amp; ditarik)
          </label>
        )}

        {hasFilters && (
          <button
            type="button"
            onClick={() => router.push(query ? `/kebijakan?q=${encodeURIComponent(query)}` : '/kebijakan')}
            className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm text-sg-neutral-600 underline-offset-2 hover:underline"
          >
            Bersihkan penyaring
          </button>
        )}
      </div>
    </form>
  )
}
