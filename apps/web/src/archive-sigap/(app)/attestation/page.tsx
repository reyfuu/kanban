import Link from 'next/link'
import { apiFetch } from '@/lib/api'
import { formatDate } from '@/lib/format'
import { requireUser } from '@/lib/session'
import { EmptyState, PageHeader, StatusBadge, type BadgeTone } from '@/components/ui'
import { PartialFailureNotice } from '@/components/feedback'

/**
 * Pernyataan Saya — the employee's side of FR-C-019/020.
 *
 * The one screen in Modul C that ordinary staff use, so it is built for someone
 * who does not think about governance: a short list of what they owe, the
 * deadline, and a way in. No campaign jargon, no percentages, no filters.
 *
 * It needs no permission beyond being signed in. Gating it would mean an
 * employee could be bound by a policy they are not permitted to acknowledge.
 */

interface Task {
  id: string
  status: string
  campaign: { id: string; name: string; dueDate: string; isMandatory: boolean }
  campaignDocument: {
    versionId: string
    document: { id: string; documentNo: string | null; title: string; documentType: string }
    version: { versionMajor: number; versionMinor: number }
  }
}

const STATUS_TONE: Record<string, BadgeTone> = {
  MENUNGGU: 'warning',
  PERLU_NYATAKAN_ULANG: 'danger',
}

const STATUS_LABEL: Record<string, string> = {
  MENUNGGU: 'Belum dinyatakan',
  PERLU_NYATAKAN_ULANG: 'Versi berubah — nyatakan ulang',
}

export default async function AttestationPage() {
  await requireUser()

  let tasks: Task[] = []
  let failed = false
  try {
    tasks = await apiFetch<Task[]>('/attestation/tugas-saya')
  } catch {
    failed = true
  }

  return (
    <div>
      <PageHeader
        title="Pernyataan Saya"
        description="Dokumen yang perlu Anda baca dan nyatakan telah dibaca. Pernyataan tercatat beserta versi dokumen, waktu, dan lama dokumen dibuka."
      />

      {failed && (
        <div className="mt-4">
          <PartialFailureNotice>
            Daftar pernyataan gagal dimuat. Ini bukan berarti Anda tidak punya kewajiban yang
            tertunggak — muat ulang halaman ini.
          </PartialFailureNotice>
        </div>
      )}

      {!failed && tasks.length === 0 && (
        <div className="mt-6">
          <EmptyState>Tidak ada dokumen yang menunggu pernyataan Anda.</EmptyState>
        </div>
      )}

      {tasks.length > 0 && (
        <ul className="mt-6 space-y-3">
          {tasks.map((task) => {
            const overdue = new Date(task.campaign.dueDate) < new Date()
            return (
              <li
                key={task.id}
                className="rounded-lg border border-sg-neutral-200 bg-sg-neutral-0 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={STATUS_TONE[task.status] ?? 'neutral'}>
                    {STATUS_LABEL[task.status] ?? task.status}
                  </StatusBadge>
                  {task.campaign.isMandatory && <StatusBadge tone="info">Wajib</StatusBadge>}
                  {overdue && <StatusBadge tone="danger">Lewat tenggat</StatusBadge>}
                </div>

                <h2 className="mt-2 text-md font-semibold text-sg-neutral-900">
                  {task.campaignDocument.document.title}
                </h2>
                <p className="mt-1 text-xs text-sg-neutral-500">
                  versi {task.campaignDocument.version.versionMajor}.
                  {task.campaignDocument.version.versionMinor}
                  <span className="mx-2">·</span>
                  tenggat {formatDate(task.campaign.dueDate)}
                  <span className="mx-2">·</span>
                  {task.campaign.name}
                </p>

                {/*
                 * The link goes to the document, where the attestation control
                 * lives. Attesting from a list would defeat FR-C-020 aturan 1
                 * entirely: the whole requirement is that the button follows
                 * actually opening the document.
                 */}
                <Link
                  href={`/kebijakan/${task.campaignDocument.document.id}?tugas=${task.id}`}
                  className="mt-3 inline-flex min-h-11 items-center rounded-lg bg-tri-navy px-4 text-sm font-semibold text-tri-on-primary transition-colors hover:bg-tri-navy-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tri-navy"
                >
                  Buka dan baca dokumen
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export const dynamic = 'force-dynamic'
