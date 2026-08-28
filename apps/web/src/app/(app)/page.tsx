import { requireUser } from '@/lib/session'

export default async function BerandaPage() {
  const user = await requireUser()

  return (
    <div>
      <h1 className="text-xl font-semibold text-sg-neutral-900">Beranda</h1>
      <p className="mt-1 text-sm text-sg-neutral-600">
        Selamat datang, {user.full_name}.
      </p>

      {user.delegations_received.length > 0 && (
        // FR-X-007 rule 3: decisions made under delegation are recorded as "on
        // behalf of", so the person needs to know the delegation is active
        // before they decide anything -- not discover it in the audit trail.
        <p className="mt-4 rounded-md border border-sg-info-500 bg-sg-info-50 px-3 py-2 text-sm text-sg-info-700">
          Anda memegang delegasi dari{' '}
          {user.delegations_received.map((d) => d.from_user.full_name).join(', ')}. Keputusan yang
          Anda ambil akan tercatat atas nama mereka.
        </p>
      )}

      <p className="mt-6 rounded-md border border-sg-warning-500 bg-sg-warning-50 px-3 py-2 text-sm text-sg-warning-700">
        Modul Access Review sedang dibangun. Daftar tugas akan muncul di sini.
      </p>
    </div>
  )
}
