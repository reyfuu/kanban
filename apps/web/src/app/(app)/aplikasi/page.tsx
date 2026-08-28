import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatDate, formatDaysAgo, formatNumber } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, EmptyState, PageHeader, StatusBadge, TableFrame, Th, type BadgeTone } from '@/components/ui'

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

const CRITICALITY_TONE: Record<string, BadgeTone> = {
  KRITIS: 'danger',
  TINGGI: 'warning',
  SEDANG: 'info',
  RENDAH: 'neutral',
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
      <PageHeader
        title="Registri Aplikasi"
        description="Aplikasi yang hak aksesnya ditinjau. Umur snapshot menentukan apakah aplikasi dapat dimasukkan ke kampanye: snapshot yang lebih tua dari 7 hari menghalangi peluncuran."
      />

      {applications.length === 0 ? (
        <div className="mt-6">
          <EmptyState>Belum ada aplikasi terdaftar.</EmptyState>
        </div>
      ) : (
        <div className="mt-6">
          <TableFrame caption="Daftar aplikasi terdaftar" minWidth="min-w-[60rem]">
            <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left">
              <tr>
                <Th>Kode</Th>
                <Th>Nama</Th>
                <Th>Kekritisan</Th>
                <Th>Pemilik</Th>
                <Th>Pemilik teknis</Th>
                <Th>Hak akses</Th>
                <Th>Frekuensi</Th>
                <Th>Snapshot terakhir</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-neutral-100">
              {applications.map((a) => (
                <tr key={a.id} className="hover:bg-sg-neutral-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Code className="font-medium text-sg-neutral-900">{a.code}</Code>
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-800">{a.name}</td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={CRITICALITY_TONE[a.criticality] ?? 'neutral'}>
                      {a.criticality}
                    </StatusBadge>
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
          </TableFrame>
        </div>
      )}
    </div>
  )
}
