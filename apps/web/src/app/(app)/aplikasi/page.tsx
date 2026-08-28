import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatDate, formatDaysAgo, formatNumber } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'

export interface ApplicationRow {
  id: string
  code: string
  name: string
  criticality: 'KRITIS' | 'TINGGI' | 'SEDANG' | 'RENDAH'
  hosting_type: string
  review_frequency: string
  owner: { id: string; full_name: string }
  tech_owner: { id: string; full_name: string } | null
  entitlement_count: number
  latest_snapshot: { id: string; captured_at: string; age_days: number } | null
  snapshot_is_stale: boolean
}

const CRITICALITY_STYLE: Record<string, string> = {
  KRITIS: 'bg-sg-danger-50 text-sg-danger-700',
  TINGGI: 'bg-sg-warning-50 text-sg-warning-700',
  SEDANG: 'bg-sg-info-50 text-sg-info-700',
  RENDAH: 'bg-sg-neutral-100 text-sg-neutral-700',
}

/**
 * Registri Aplikasi — FR-B-001.
 *
 * The snapshot column carries the weight here. FR-B-008 rule 3 refuses to launch
 * a campaign over an application whose snapshot is older than seven days, so
 * showing the age in the registry is what lets someone fix it before they are
 * standing in the campaign wizard being told they cannot proceed.
 */
export default async function AplikasiPage() {
  const user = await requireUser()
  if (!hasPermission(user, 'application:read')) notFound()

  const applications = await apiFetch<ApplicationRow[]>('/applications')

  return (
    <div>
      <h1 className="text-xl font-semibold text-sg-neutral-900">Registri Aplikasi</h1>
      <p className="mt-1 max-w-3xl text-sm text-sg-neutral-600">
        Aplikasi yang hak aksesnya ditinjau. Umur snapshot menentukan apakah aplikasi dapat
        dimasukkan ke kampanye: snapshot yang lebih tua dari 7 hari menghalangi peluncuran.
      </p>

      {applications.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-sg-neutral-300 bg-sg-neutral-0 px-4 py-10 text-center text-sm text-sg-neutral-600">
          Belum ada aplikasi terdaftar.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
          <table className="w-full min-w-[60rem] text-sm">
            <caption className="sr-only">Daftar aplikasi terdaftar</caption>
            <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left text-xs uppercase tracking-wide text-sg-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Kode</th>
                <th scope="col" className="px-3 py-2 font-medium">Nama</th>
                <th scope="col" className="px-3 py-2 font-medium">Kekritisan</th>
                <th scope="col" className="px-3 py-2 font-medium">Pemilik</th>
                <th scope="col" className="px-3 py-2 font-medium">Pemilik teknis</th>
                <th scope="col" className="px-3 py-2 font-medium">Hak akses</th>
                <th scope="col" className="px-3 py-2 font-medium">Frekuensi</th>
                <th scope="col" className="px-3 py-2 font-medium">Snapshot terakhir</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-neutral-100">
              {applications.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-sg-neutral-900">{a.code}</td>
                  <td className="px-3 py-2 text-sg-neutral-800">{a.name}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        CRITICALITY_STYLE[a.criticality] ?? 'bg-sg-neutral-100 text-sg-neutral-700'
                      }`}
                    >
                      {a.criticality}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-700">{a.owner.full_name}</td>
                  <td className="px-3 py-2 text-sg-neutral-700">{a.tech_owner?.full_name ?? '—'}</td>
                  <td className="px-3 py-2 tabular-nums text-sg-neutral-700">
                    {formatNumber(a.entitlement_count)}
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-600">{a.review_frequency}</td>
                  <td className="px-3 py-2">
                    {a.latest_snapshot === null ? (
                      <span className="text-sg-danger-700">Belum ada</span>
                    ) : (
                      <span className={a.snapshot_is_stale ? 'text-sg-danger-700' : 'text-sg-neutral-700'}>
                        {formatDate(a.latest_snapshot.captured_at)}
                        <span className="ml-1 text-xs">
                          ({formatDaysAgo(a.latest_snapshot.age_days)})
                        </span>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
