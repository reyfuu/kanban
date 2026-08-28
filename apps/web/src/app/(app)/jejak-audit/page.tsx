import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatDateTimePrecise } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { VerifyChainButton } from './verify-button'

interface AuditRow {
  id: string
  occurred_at: string
  actor: { id: string; full_name: string }
  actor_role_at_action: string[]
  action: string
  object_type: string
  object_id: string
  ip_address: string | null
  prev_hash: string | null
  hash: string
}

export default async function JejakAuditPage() {
  const user = await requireUser()
  // 404 rather than a permission message: the nav already hides this, so
  // arriving here means the URL was typed. Rendering "you are not allowed"
  // would confirm the page exists and what it is called.
  if (!hasPermission(user, 'audit-log:verify')) notFound()

  const rows = await apiFetch<AuditRow[]>('/audit-logs?limit=50')

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-sg-neutral-900">Jejak Audit</h1>
          <p className="mt-1 max-w-2xl text-sm text-sg-neutral-600">
            Setiap catatan memuat sidik jari catatan sebelumnya. Penghapusan atau penyisipan di
            tengah rantai memutus keterkaitan dan terdeteksi oleh pemeriksaan integritas.
          </p>
        </div>
        <VerifyChainButton />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
        <table className="w-full min-w-[56rem] text-sm">
          <caption className="sr-only">50 catatan jejak audit terakhir</caption>
          <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left">
            <tr className="text-xs uppercase tracking-wide text-sg-neutral-600">
              <th scope="col" className="px-3 py-2 font-medium">Waktu</th>
              <th scope="col" className="px-3 py-2 font-medium">Aktor</th>
              <th scope="col" className="px-3 py-2 font-medium">Peran saat aksi</th>
              <th scope="col" className="px-3 py-2 font-medium">Aksi</th>
              <th scope="col" className="px-3 py-2 font-medium">Objek</th>
              <th scope="col" className="px-3 py-2 font-medium">Alamat IP</th>
              <th scope="col" className="px-3 py-2 font-medium">Sidik jari</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sg-neutral-100">
            {rows.map((row) => (
              <tr key={row.id} className="align-top">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-sg-neutral-700">
                  {formatDateTimePrecise(row.occurred_at)}
                </td>
                <td className="px-3 py-2 text-sg-neutral-900">{row.actor.full_name}</td>
                <td className="px-3 py-2 text-xs text-sg-neutral-600">
                  {row.actor_role_at_action.join(' · ')}
                </td>
                <td className="px-3 py-2 font-medium text-sg-neutral-900">{row.action}</td>
                <td className="px-3 py-2 text-xs text-sg-neutral-600">{row.object_type}</td>
                <td className="px-3 py-2 tabular-nums text-xs text-sg-neutral-600">
                  {row.ip_address ?? '—'}
                </td>
                {/* Truncated because the full digest is 64 characters and would
                    dominate the row. The verification button is what actually
                    checks the chain; this is only a visual anchor. */}
                <td className="px-3 py-2 font-mono text-xs text-sg-neutral-500">
                  {row.hash.slice(0, 12)}…
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {rows.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-sg-neutral-500">
            Belum ada catatan jejak audit.
          </p>
        )}
      </div>
    </div>
  )
}
