import { notFound } from 'next/navigation'
import { apiFetch } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { hasPermission, requireUser } from '@/lib/session'

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
const STATUS_STYLE: Record<string, string> = {
  TERBUKA: 'bg-sg-neutral-100 text-sg-neutral-700',
  DALAM_PROSES: 'bg-sg-info-50 text-sg-info-700',
  MENUNGGU_VERIFIKASI: 'bg-sg-warning-50 text-sg-warning-700',
  TERVERIFIKASI_TERTUTUP: 'bg-sg-success-50 text-sg-success-700',
  GAGAL_DIVERIFIKASI: 'bg-sg-danger-50 text-sg-danger-700',
  DIKECUALIKAN: 'bg-sg-neutral-100 text-sg-neutral-600',
  TIDAK_DAPAT_DIVERIFIKASI: 'bg-sg-danger-50 text-sg-danger-700',
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

  return (
    <div>
      <h1 className="text-xl font-semibold text-sg-neutral-900">Tiket Pencabutan</h1>
      <p className="mt-1 max-w-3xl text-sm text-sg-neutral-600">
        Setiap keputusan Cabut atau Ubah yang telah ditandatangani menghasilkan satu tiket. Tiket
        tidak dapat ditutup dengan menyatakan pekerjaannya selesai — penutupan hanya terjadi bila
        snapshot baru membuktikan akses tersebut sudah tidak ada.
      </p>

      {tickets.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-sg-neutral-300 bg-sg-neutral-0 px-4 py-10 text-center text-sm text-sg-neutral-600">
          Belum ada tiket pencabutan.
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-sg-neutral-200 bg-sg-neutral-0">
          <table className="w-full min-w-[64rem] text-sm">
            <caption className="sr-only">Daftar tiket pencabutan</caption>
            <thead className="border-b border-sg-neutral-200 bg-sg-neutral-50 text-left text-xs uppercase tracking-wide text-sg-neutral-600">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Nomor</th>
                <th scope="col" className="px-3 py-2 font-medium">Aplikasi</th>
                <th scope="col" className="px-3 py-2 font-medium">Hak akses</th>
                <th scope="col" className="px-3 py-2 font-medium">Akun</th>
                <th scope="col" className="px-3 py-2 font-medium">Tindakan</th>
                <th scope="col" className="px-3 py-2 font-medium">Pelaksana</th>
                <th scope="col" className="px-3 py-2 font-medium">Tenggat SLA</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Bukti</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sg-neutral-100">
              {tickets.map((t) => (
                <tr key={t.id}>
                  <td className="whitespace-nowrap px-3 py-2 font-medium text-sg-neutral-900">
                    {t.ticket_no}
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-700">{t.application.name}</td>
                  <td className="px-3 py-2 text-sg-neutral-700">
                    {t.entitlement.display_name}
                    {t.entitlement.is_privileged && (
                      <span className="ml-2 rounded bg-sg-warning-50 px-1.5 py-0.5 text-xs font-semibold text-sg-warning-700">
                        ISTIMEWA
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-sg-neutral-600">{t.account_id}</td>
                  <td className="px-3 py-2 text-sg-neutral-700">{t.action_type}</td>
                  <td className="px-3 py-2 text-sg-neutral-700">{t.assignee.full_name}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums text-sg-neutral-700">
                    {formatDate(t.sla_due_date)}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_STYLE[t.status] ?? 'bg-sg-neutral-100 text-sg-neutral-700'
                      }`}
                    >
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </td>
                  {/* K-1 made visible: a closed ticket names the snapshot that
                      closed it, and nothing else can put it in that state. */}
                  <td className="px-3 py-2 font-mono text-xs text-sg-neutral-500">
                    {t.verified_by_snapshot_id
                      ? `snapshot ${t.verified_by_snapshot_id.slice(0, 8)}…`
                      : '—'}
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
