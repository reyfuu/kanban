import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'
import { Code, EmptyState, PageHeader, StatusBadge, TableFrame, Th, type BadgeTone } from '@/components/ui'
import { TicketActions } from './ticket-actions'

interface Ticket {
  id: string
  ticket_no: string
  application: { id: string; code: string; name: string }
  entitlement: { id: string; display_name: string; is_privileged: boolean }
  account_id: string
  action_type: string
  assignee: { id: string; full_name: string }
  sla_due_date: string
  status: string
  verified_by_snapshot_id: string | null
  external_ticket_ref: string | null
}

/**
 * Tiket Pencabutan — FR-B-018 s.d. FR-B-021, and the visible face of K-1.
 *
 * The "Bukti" column is the point of this screen. A ticket in Terverifikasi
 * Tertutup shows the snapshot that proved the access was gone; a ticket that
 * cannot show one cannot be in that state, because the database refuses it
 * (chk_revocation_ticket_verified_requires_snapshot). Putting the evidence next
 * to the status is what lets an auditor check the claim rather than accept it.
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  TERBUKA: 'neutral',
  DALAM_PROSES: 'info',
  MENUNGGU_VERIFIKASI: 'warning',
  TERVERIFIKASI_TERTUTUP: 'success',
  GAGAL_DIVERIFIKASI: 'danger',
  DIKECUALIKAN: 'muted',
  TIDAK_DAPAT_DIVERIFIKASI: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  TERBUKA: 'Terbuka',
  DALAM_PROSES: 'Dalam Proses',
  MENUNGGU_VERIFIKASI: 'Menunggu Verifikasi',
  TERVERIFIKASI_TERTUTUP: 'Terverifikasi Tertutup',
  GAGAL_DIVERIFIKASI: 'Gagal Diverifikasi',
  DIKECUALIKAN: 'Dikecualikan',
  TIDAK_DAPAT_DIVERIFIKASI: 'Tidak Dapat Diverifikasi',
}

export default async function TiketPage() {
  const user = await requireUser()
  if (!hasPermission(user, 'ticket:read')) notFound()

  const tickets = await apiFetch<Ticket[]>('/revocation-tickets')
  const canExecute = hasPermission(user, 'ticket:execute')

  return (
    <div>
      <PageHeader
        title="Tiket Pencabutan"
        description="Setiap keputusan Cabut atau Ubah yang telah ditandatangani menghasilkan satu tiket. Tiket tidak dapat ditutup dengan menyatakan pekerjaannya selesai — penutupan hanya terjadi bila snapshot baru membuktikan akses tersebut sudah tidak ada."
      />

      {tickets.length === 0 ? (
        <div className="mt-6">
          <EmptyState>Belum ada tiket pencabutan.</EmptyState>
        </div>
      ) : (
        <div className="mt-6">
          <TableFrame caption="Daftar tiket pencabutan" minWidth="min-w-[64rem]">
            <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left">
              <tr>
                <Th>Nomor</Th>
                <Th>Aplikasi</Th>
                <Th>Hak akses</Th>
                <Th>Akun</Th>
                <Th>Tindakan</Th>
                <Th>Pelaksana</Th>
                <Th>Tenggat SLA</Th>
                <Th>Status</Th>
                <Th>Bukti</Th>
                {canExecute && <Th>Aksi</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-neutral-100">
              {tickets.map((t) => (
                <tr key={t.id} className="hover:bg-sg-neutral-50">
                  <td className="whitespace-nowrap px-3 py-2">
                    <Code className="font-medium text-sg-neutral-900">{t.ticket_no}</Code>
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-700">{t.application.name}</td>
                  <td className="px-3 py-2 text-sg-neutral-700">
                    {t.entitlement.display_name}
                    {t.entitlement.is_privileged && (
                      <span className="ml-2 inline-flex items-center rounded bg-sg-warning-50 px-1.5 py-0.5 text-2xs font-semibold text-sg-warning-700">
                        ISTIMEWA
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-600">
                    <Code className="text-xs">{t.account_id}</Code>
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-700">{t.action_type}</td>
                  <td className="px-3 py-2 text-sg-neutral-700">{t.assignee.full_name}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-sg-neutral-700">
                    {formatDate(t.sla_due_date)}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge tone={STATUS_TONE[t.status] ?? 'neutral'}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </StatusBadge>
                  </td>
                  {/* K-1 made visible: a closed ticket names the snapshot that
                      closed it, and nothing else can put it in that state. */}
                  <td className="px-3 py-2 text-xs text-sg-neutral-500">
                    {t.verified_by_snapshot_id ? (
                      <span>
                        snapshot <Code>{t.verified_by_snapshot_id.slice(0, 8)}…</Code>
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  {canExecute && (
                    <td className="px-3 py-2 align-top">
                      <TicketActions ticketId={t.id} status={t.status} canExecute={canExecute} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </TableFrame>
        </div>
      )}
    </div>
  )
}
