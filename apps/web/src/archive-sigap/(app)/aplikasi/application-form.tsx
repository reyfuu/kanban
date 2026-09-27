'use client'

import { useState, useTransition } from 'react'
import { createApplication, deactivateApplication, updateApplication } from './actions'

export interface Employee {
  id: string
  full_name: string
  job_title: string | null
  employee_number: string
}

export interface EditableApp {
  id: string
  code: string
  name: string
  criticality: string
  hosting_type: string
  review_frequency: string
  owner: { id: string; full_name: string }
  tech_owner: { id: string; full_name: string } | null
}

const CRITICALITY = ['KRITIS', 'TINGGI', 'SEDANG', 'RENDAH'] as const
const HOSTING = ['ON_PREMISE', 'SAAS', 'HIBRIDA'] as const
const FREQUENCY = ['TRIWULANAN', 'SEMESTERAN', 'TAHUNAN'] as const

/**
 * The registry's write controls (FR-B-001): a "Daftarkan aplikasi" button that
 * opens a form, and — when a row is passed as `editing` — the same form
 * pre-filled for an edit. One component for both because the fields are
 * identical; only the code is locked on edit, since a code change would break
 * every snapshot and ticket that already refers to it.
 *
 * The form validates nothing the server does not re-validate. It exists so the
 * person picks a real owner from a list instead of typing a UUID, and sees a
 * duplicate-code or unknown-owner refusal in place.
 */
export function ApplicationForm(props: {
  employees: Employee[]
  editing?: EditableApp
  onClose?: () => void
}) {
  const editing = props.editing
  const [open, setOpen] = useState(Boolean(editing))
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [code, setCode] = useState(editing?.code ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [ownerId, setOwnerId] = useState(editing?.owner.id ?? '')
  const [techOwnerId, setTechOwnerId] = useState(editing?.tech_owner?.id ?? '')
  const [criticality, setCriticality] = useState(editing?.criticality ?? 'SEDANG')
  const [hosting, setHosting] = useState(editing?.hosting_type ?? 'ON_PREMISE')
  const [frequency, setFrequency] = useState(editing?.review_frequency ?? 'TAHUNAN')

  function close() {
    setOpen(false)
    setError(null)
    props.onClose?.()
  }

  function submit() {
    setError(null)
    startTransition(async () => {
      const base = {
        name,
        ownerEmployeeId: ownerId,
        techOwnerEmployeeId: techOwnerId || null,
        criticality,
        hostingType: hosting,
        reviewFrequency: frequency,
      }
      const result = editing
        ? await updateApplication(editing.id, base)
        : await createApplication({ code, ...base })
      if (!result.ok) setError(result.message)
      else close()
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-md bg-sg-accent-600 px-4 text-sm font-medium text-sg-neutral-0 shadow-sm transition-colors hover:bg-sg-accent-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sg-accent-600"
      >
        Daftarkan aplikasi
      </button>
    )
  }

  return (
    <div className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4 shadow-md">
      <h2 className="text-md font-semibold text-sg-neutral-900">
        {editing ? `Sunting ${editing.code}` : 'Daftarkan aplikasi baru'}
      </h2>

      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Labeled label="Kode aplikasi">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            disabled={Boolean(editing)}
            placeholder="mis. BACKOFFICE"
            className={inputCls + ' font-mono disabled:bg-sg-neutral-100'}
          />
        </Labeled>
        <Labeled label="Nama">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Labeled>

        <Labeled label="Pemilik bisnis">
          <EmployeeSelect employees={props.employees} value={ownerId} onChange={setOwnerId} />
        </Labeled>
        <Labeled label="Pemilik teknis (opsional)">
          <EmployeeSelect
            employees={props.employees}
            value={techOwnerId}
            onChange={setTechOwnerId}
            allowEmpty
          />
        </Labeled>

        <Labeled label="Kekritisan">
          <Select value={criticality} onChange={setCriticality} options={CRITICALITY} />
        </Labeled>
        <Labeled label="Hosting">
          <Select value={hosting} onChange={setHosting} options={HOSTING} />
        </Labeled>
        <Labeled label="Frekuensi review">
          <Select value={frequency} onChange={setFrequency} options={FREQUENCY} />
        </Labeled>

        {error && (
          <p role="alert" className="sm:col-span-2 rounded-md border border-sg-danger-500 bg-sg-danger-50 px-3 py-2 text-sm text-sg-danger-700">
            {error}
          </p>
        )}

        <div className="sm:col-span-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={close}
            className="rounded-md border border-sg-neutral-300 px-3 py-2 text-sm text-sg-neutral-700 hover:bg-sg-neutral-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={pending || !name || !ownerId || (!editing && !code)}
            className="rounded-md bg-sg-accent-600 px-4 py-2 text-sm font-medium text-sg-neutral-0 hover:bg-sg-accent-700 disabled:opacity-50"
          >
            {pending ? 'Menyimpan…' : editing ? 'Simpan perubahan' : 'Daftarkan'}
          </button>
        </div>
      </form>
    </div>
  )
}

/** A small inline "Sunting" / "Nonaktifkan" control for a registry row. */
export function ApplicationRowActions(props: { app: EditableApp; employees: Employee[] }) {
  const [editing, setEditing] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  if (editing) {
    return <ApplicationForm employees={props.employees} editing={props.app} onClose={() => setEditing(false)} />
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="inline-flex min-h-11 items-center rounded-md border border-sg-neutral-300 px-3 text-sm font-medium text-sg-neutral-700 hover:bg-sg-neutral-50"
        >
          Sunting
        </button>
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              setError(null)
              const result = await deactivateApplication(props.app.id)
              if (!result.ok) setError(result.message)
            })
          }
          disabled={pending}
          className="inline-flex min-h-11 items-center rounded-md border border-sg-danger-500 px-3 text-sm font-medium text-sg-danger-700 hover:bg-sg-danger-50 disabled:opacity-50"
        >
          {pending ? '…' : 'Nonaktifkan'}
        </button>
      </div>
      {error && <span className="text-xs text-sg-danger-700">{error}</span>}
    </div>
  )
}

const inputCls =
  'mt-1 min-h-11 w-full rounded-md border border-sg-neutral-300 bg-sg-neutral-0 px-3 py-2 text-sm text-sg-neutral-900 placeholder:text-sg-neutral-400 focus:border-sg-accent-600 focus:outline focus:outline-2 focus:outline-sg-accent-600'

function Labeled(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-xs font-medium text-sg-neutral-700">
      {props.label}
      {props.children}
    </label>
  )
}

function Select(props: { value: string; onChange: (v: string) => void; options: readonly string[] }) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className={inputCls}>
      {props.options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}

function EmployeeSelect(props: {
  employees: Employee[]
  value: string
  onChange: (v: string) => void
  allowEmpty?: boolean
}) {
  return (
    <select value={props.value} onChange={(e) => props.onChange(e.target.value)} className={inputCls}>
      {props.allowEmpty && <option value="">— tidak ada —</option>}
      {!props.allowEmpty && <option value="">— pilih —</option>}
      {props.employees.map((e) => (
        <option key={e.id} value={e.id}>
          {e.full_name}
          {e.job_title ? ` · ${e.job_title}` : ''}
        </option>
      ))}
    </select>
  )
}
