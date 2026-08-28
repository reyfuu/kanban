import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatDateTimePrecise } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, PageHeader, RecordCard, TableFrame, Th } from '@/components/ui'
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
      <PageHeader
        title="Jejak Audit"
        description="Setiap catatan memuat sidik jari catatan sebelumnya. Penghapusan atau penyisipan di tengah rantai memutus keterkaitan dan terdeteksi oleh pemeriksaan integritas."
        action={<VerifyChainButton />}
      />

      <div className="mt-6">
        <TableFrame
          caption="50 catatan jejak audit terakhir"
          cards={rows.map((row) => (
            <RecordCard
              key={row.id}
              title={row.action}
              fields={[
                { label: 'Waktu', value: formatDateTimePrecise(row.occurred_at) },
                { label: 'Aktor', value: row.actor.full_name },
                { label: 'Peran', value: row.actor_role_at_action.join(' · ') },
                { label: 'Objek', value: row.object_type },
                {
                  label: 'Alamat IP',
                  value: row.ip_address ? <Code className="text-xs">{row.ip_address}</Code> : '—',
                },
                { label: 'Sidik jari', value: <Code className="text-xs">{row.hash.slice(0, 12)}…</Code> },
              ]}
            />
          ))}
        >
          <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left">
            <tr>
              <Th>Waktu</Th>
              <Th>Aktor</Th>
              <Th>Peran saat aksi</Th>
              <Th>Aksi</Th>
              <Th>Objek</Th>
              <Th>Alamat IP</Th>
              <Th>Sidik jari</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sg-neutral-100">
            {rows.map((row) => (
              <tr key={row.id} className="align-top hover:bg-sg-neutral-50">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-sg-neutral-700">
                  {formatDateTimePrecise(row.occurred_at)}
                </td>
                <td className="px-3 py-2 text-sg-neutral-900">{row.actor.full_name}</td>
                <td className="px-3 py-2 text-xs text-sg-neutral-600">
                  {row.actor_role_at_action.join(' · ')}
                </td>
                <td className="px-3 py-2 font-medium text-sg-neutral-900">{row.action}</td>
                <td className="px-3 py-2 text-xs text-sg-neutral-600">{row.object_type}</td>
                <td className="px-3 py-2 text-xs text-sg-neutral-600">
                  {row.ip_address ? <Code className="tabular-nums">{row.ip_address}</Code> : '—'}
                </td>
                {/* Truncated because the full digest is 64 characters and would
                    dominate the row. The verification button is what actually
                    checks the chain; this is only a visual anchor. */}
                <td className="px-3 py-2 text-xs text-sg-neutral-500">
                  <Code>{row.hash.slice(0, 12)}…</Code>
                </td>
              </tr>
            ))}
          </tbody>
        </TableFrame>

        {rows.length === 0 && (
          <p className="mt-3 px-3 py-8 text-center text-sm text-sg-neutral-500">
            Belum ada catatan jejak audit.
          </p>
        )}
      </div>
    </div>
  )
}
