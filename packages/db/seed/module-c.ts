import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

/**
 * Modul C demo dataset — a small policy corpus that is actually searchable.
 *
 * Shaped to demonstrate the four things Modul C claims, rather than to look
 * full:
 *
 * 1. A document in force with real Indonesian article structure, so chunking
 *    produces citations like "Bab II · Pasal 5" instead of an offset.
 * 2. A document with two versions, the older one superseded with a closed
 *    force window — the state FR-C-007 aturan 3 exists to query.
 * 3. A RAHASIA document owned by Direksi, so signing in as an ordinary
 *    employee demonstrates FR-C-010: it is absent from results, from the facet
 *    counts, and from suggestions, with no "you may not see this" hint.
 * 4. A document past its review date, still in force — FR-C-008 aturan 4.
 *
 * Idempotent, and writes no audit entries: this is an operator data load, not a
 * user action, the same reasoning as the rest of the seed.
 */

interface Ctx {
  prisma: PrismaClient
  employeeIds: Map<string, string>
  orgIds: Map<string, string>
  userIds: Map<string, string>
}

interface SeedDocument {
  documentNo: string
  title: string
  documentType: 'KEBIJAKAN' | 'PEDOMAN' | 'SOP' | 'INSTRUKSI_KERJA' | 'SURAT_EDARAN'
  classification: 'PUBLIK' | 'INTERNAL' | 'TERBATAS' | 'RAHASIA'
  processArea:
    | 'DEALING'
    | 'SETTLEMENT'
    | 'KUSTODIAN'
    | 'KEPATUHAN'
    | 'TI'
    | 'MANAJEMEN_RISIKO'
    | 'UMUM'
  orgCode: string
  owner: string
  tags: string[]
  summary: string
  reviewCycleMonths: number
  /** Months from today for the next review; negative = already overdue. */
  reviewOffsetMonths: number
  /** Days before today the current version took force. */
  effectiveDaysAgo: number
  body: string
  /** When set, a previous version that this one superseded. */
  previousVersion?: { changeSummary: string; body: string; daysAgo: number }
}

const DOCUMENTS: SeedDocument[] = [
  {
    documentNo: 'SOP-OPS-014',
    title: 'SOP Penyelesaian Transaksi Efek',
    documentType: 'SOP',
    classification: 'INTERNAL',
    processArea: 'SETTLEMENT',
    orgCode: 'OPS',
    owner: 'EMP-00174', // Dewi Lestari
    tags: ['settlement', 't+2', 'kliring'],
    summary:
      'Prosedur penyelesaian transaksi efek di pasar reguler, termasuk penanganan gagal serah dan gagal bayar.',
    reviewCycleMonths: 12,
    reviewOffsetMonths: 8,
    effectiveDaysAgo: 120,
    body: `BAB I KETENTUAN UMUM

Pasal 1

Dalam prosedur ini yang dimaksud dengan penyelesaian transaksi adalah proses pemenuhan hak dan kewajiban yang timbul dari transaksi efek di Bursa.

Pasal 2

Penyelesaian transaksi di pasar reguler dilakukan pada hari bursa kedua setelah terjadinya transaksi, atau T+2.

BAB II PELAKSANAAN

Pasal 3

Divisi Operasional wajib melakukan rekonsiliasi posisi efek dan dana setiap hari bursa sebelum pukul 16.00 WIB.

Pasal 4

Setiap selisih hasil rekonsiliasi wajib ditelusuri pada hari yang sama dan dilaporkan kepada Kepala Divisi Operasional.

BAB III GAGAL SERAH DAN GAGAL BAYAR

Pasal 5

Dalam hal terjadi gagal serah, Divisi Operasional wajib melakukan pembelian pengganti sesuai ketentuan Lembaga Kliring dan Penjaminan.

Pasal 6

Seluruh peristiwa gagal serah dan gagal bayar wajib dicatat dan dilaporkan kepada Divisi Kepatuhan paling lambat satu hari bursa berikutnya.`,
    previousVersion: {
      changeSummary:
        'Versi awal dengan siklus penyelesaian T+3, sebelum penyesuaian ketentuan Bursa.',
      daysAgo: 400,
      body: `BAB I KETENTUAN UMUM

Pasal 1

Penyelesaian transaksi di pasar reguler dilakukan pada hari bursa ketiga setelah terjadinya transaksi, atau T+3.`,
    },
  },
  {
    documentNo: 'KEB-KEP-001',
    title: 'Kebijakan Pengendalian Benturan Kepentingan',
    documentType: 'KEBIJAKAN',
    classification: 'INTERNAL',
    processArea: 'KEPATUHAN',
    orgCode: 'KEP',
    owner: 'EMP-00093', // Hendra Wijaya
    tags: ['benturan kepentingan', 'kepatuhan', 'etika'],
    summary:
      'Kebijakan pengelolaan benturan kepentingan antara kepentingan perusahaan, karyawan, dan nasabah.',
    reviewCycleMonths: 24,
    reviewOffsetMonths: 14,
    effectiveDaysAgo: 300,
    body: `BAB I MAKSUD DAN TUJUAN

Pasal 1

Kebijakan ini bertujuan memastikan seluruh keputusan bisnis diambil bebas dari pengaruh kepentingan pribadi.

BAB II KEWAJIBAN KARYAWAN

Pasal 2

Setiap karyawan wajib mengungkapkan kepemilikan efek pribadi dan transaksi efek atas namanya sendiri maupun pihak terafiliasi.

Pasal 3

Karyawan yang memiliki benturan kepentingan atas suatu transaksi wajib mengundurkan diri dari proses pengambilan keputusan atas transaksi tersebut.

BAB III PENGAWASAN

Pasal 4

Divisi Kepatuhan melakukan pemantauan berkala atas pengungkapan sebagaimana dimaksud dalam Pasal 2 dan melaporkan hasilnya kepada Direksi setiap triwulan.`,
  },
  {
    documentNo: 'PED-TI-003',
    title: 'Pedoman Pengelolaan Hak Akses Aplikasi',
    documentType: 'PEDOMAN',
    classification: 'TERBATAS',
    processArea: 'TI',
    orgCode: 'TI',
    owner: 'EMP-00211', // Rina Kusuma
    tags: ['hak akses', 'itgc', 'user access review'],
    summary:
      'Pedoman pemberian, peninjauan, dan pencabutan hak akses pada aplikasi kritis perusahaan.',
    reviewCycleMonths: 12,
    // Deliberately overdue: FR-C-008 aturan 4 says it stays in force and shows
    // up on the compliance dashboard. A demo where nothing is late never
    // demonstrates that the system does not auto-revoke.
    reviewOffsetMonths: -2,
    effectiveDaysAgo: 420,
    body: `BAB I PEMBERIAN HAK AKSES

Pasal 1

Pemberian hak akses pada aplikasi kritis wajib melalui persetujuan pemilik aplikasi dan tercatat pada sistem tiket.

Pasal 2

Hak akses istimewa hanya diberikan untuk jangka waktu terbatas dan wajib ditinjau setiap triwulan.

BAB II PENINJAUAN BERKALA

Pasal 3

Peninjauan hak akses pengguna dilakukan sekurang-kurangnya dua kali dalam satu tahun untuk seluruh aplikasi berklasifikasi kritis.

Pasal 4

Peninjau tidak diperkenankan menyetujui hak aksesnya sendiri, dan hasil peninjauan wajib ditandatangani oleh pemilik aplikasi.

BAB III PENCABUTAN

Pasal 5

Hak akses yang diputuskan untuk dicabut wajib dieksekusi paling lambat lima hari kerja, dan penutupannya hanya diakui bila dibuktikan oleh pengambilan data akses berikutnya.`,
  },
  {
    documentNo: 'KEB-DIR-009',
    title: 'Kebijakan Rencana Aksi Korporasi',
    documentType: 'KEBIJAKAN',
    classification: 'RAHASIA',
    processArea: 'MANAJEMEN_RISIKO',
    orgCode: 'DIR',
    owner: 'EMP-00002', // Direktur Utama
    tags: ['aksi korporasi', 'rahasia'],
    summary: 'Kebijakan penanganan informasi rencana aksi korporasi yang belum dipublikasikan.',
    reviewCycleMonths: 24,
    reviewOffsetMonths: 20,
    effectiveDaysAgo: 60,
    body: `BAB I KETENTUAN UMUM

Pasal 1

Informasi mengenai rencana aksi korporasi yang belum dipublikasikan merupakan informasi rahasia dan hanya boleh diakses oleh pihak yang ditunjuk Direksi.

Pasal 2

Setiap pihak yang memperoleh akses atas informasi sebagaimana dimaksud dalam Pasal 1 wajib menandatangani pernyataan kerahasiaan.`,
  },
]

export async function seedModuleC(ctx: Ctx): Promise<void> {
  const { prisma, employeeIds, orgIds, userIds } = ctx
  const authorUserId = userIds.get('hendra.wijaya') ?? userIds.get('admin.sigap')
  if (!authorUserId) return

  for (const spec of DOCUMENTS) {
    const existing = await prisma.document.findUnique({
      where: { documentNo: spec.documentNo },
      select: { id: true },
    })
    // Idempotent: an existing document is left exactly as it is, including any
    // lifecycle moves someone made while demonstrating.
    if (existing) continue

    const ownerEmployeeId = employeeIds.get(spec.owner)
    const ownerOrgUnitId = orgIds.get(spec.orgCode)
    if (!ownerEmployeeId || !ownerOrgUnitId) continue

    const documentId = randomUUID()
    const effectiveFrom = daysAgo(spec.effectiveDaysAgo)

    await prisma.document.create({
      data: {
        id: documentId,
        documentNo: spec.documentNo,
        title: spec.title,
        documentType: spec.documentType,
        ownerOrgUnitId,
        ownerEmployeeId,
        classification: spec.classification,
        processArea: spec.processArea,
        tags: spec.tags,
        summary: spec.summary,
        reviewCycleMonths: spec.reviewCycleMonths,
        nextReviewDate: monthsFromToday(spec.reviewOffsetMonths),
        status: 'BERLAKU',
        createdBy: authorUserId,
      },
    })

    let major = 1
    if (spec.previousVersion) {
      // The superseded version, with a closed window ending the day before the
      // current one took force. FR-C-004 aturan 2: no gap.
      const previousId = randomUUID()
      await prisma.documentVersion.create({
        data: {
          id: previousId,
          documentId,
          versionMajor: 1,
          versionMinor: 0,
          body: spec.previousVersion.body,
          extractedText: spec.previousVersion.body,
          changeSummary: spec.previousVersion.changeSummary,
          status: 'DIGANTIKAN',
          effectiveFrom: daysAgo(spec.previousVersion.daysAgo),
          effectiveUntil: addDays(effectiveFrom, -1),
          approvedAt: daysAgo(spec.previousVersion.daysAgo + 7),
          createdBy: authorUserId,
        },
      })
      await createChunks(prisma, previousId, spec.title, spec.previousVersion.body)
      major = 2
    }

    const versionId = randomUUID()
    await prisma.documentVersion.create({
      data: {
        id: versionId,
        documentId,
        versionMajor: major,
        versionMinor: 0,
        body: spec.body,
        extractedText: spec.body,
        changeSummary:
          major === 1
            ? 'Versi pertama yang disahkan.'
            : 'Penyesuaian siklus penyelesaian mengikuti ketentuan Bursa.',
        status: 'BERLAKU',
        effectiveFrom,
        approvedAt: addDays(effectiveFrom, -7),
        createdBy: authorUserId,
      },
    })
    await createChunks(prisma, versionId, spec.title, spec.body)
  }

  // FR-C-022 · the bridge to Modul A. The access-management pedoman is the
  // written procedure behind the periodic access review control, which is what
  // makes the control testable rather than asserted.
  const control = await prisma.control.findUnique({ where: { code: 'ITGC-AC-02' } })
  const pedoman = await prisma.document.findUnique({ where: { documentNo: 'PED-TI-003' } })
  if (control && pedoman) {
    const linked = await prisma.documentControlLink.findFirst({
      where: { documentId: pedoman.id, controlId: control.id },
      select: { id: true },
    })
    if (!linked) {
      await prisma.documentControlLink.create({
        data: {
          id: randomUUID(),
          documentId: pedoman.id,
          controlId: control.id,
          note: 'Prosedur tertulis yang mendasari kontrol review hak akses berkala.',
          linkedBy: authorUserId,
        },
      })
    }
  }

  // FR-C-010 aturan 2 · an explicit grant, so the demo can show a TERBATAS
  // document opening up for one unit without becoming visible to everyone.
  if (pedoman) {
    const skai = orgIds.get('SKAI')
    if (skai) {
      const grant = await prisma.documentAccess.findFirst({
        where: { documentId: pedoman.id, subjectType: 'UNIT', subjectId: skai },
        select: { id: true },
      })
      if (!grant) {
        await prisma.documentAccess.create({
          data: {
            id: randomUUID(),
            documentId: pedoman.id,
            subjectType: 'UNIT',
            subjectId: skai,
            grantedBy: authorUserId,
          },
        })
      }
    }
  }
}

/**
 * Chunking, duplicated here rather than imported from apps/api.
 *
 * The seed is a database package and importing across into the API package
 * would invert the dependency (ADR-01). The shape only has to be good enough
 * to make search work in a demo; the API re-chunks on every real write, so
 * anything authored through the UI gets the proper structure-aware version.
 */
async function createChunks(
  prisma: PrismaClient,
  versionId: string,
  title: string,
  body: string,
): Promise<void> {
  const sections = splitByArticle(title, body)
  if (sections.length === 0) return
  await prisma.documentChunk.createMany({
    data: sections.map((s, index) => ({
      id: randomUUID(),
      documentVersionId: versionId,
      chunkIndex: index,
      sectionRef: s.sectionRef,
      content: s.content,
      tokenCount: s.content.split(/\s+/).filter(Boolean).length,
    })),
  })
}

function splitByArticle(
  title: string,
  body: string,
): { sectionRef: string | null; content: string }[] {
  const out: { sectionRef: string | null; content: string }[] = []
  let bab: string | null = null
  let pasal: string | null = null
  let buffer: string[] = []

  const flush = () => {
    const text = buffer.join('\n').trim()
    buffer = []
    if (text === '') return
    const ref = [bab, pasal].filter(Boolean).join(' · ') || null
    out.push({ sectionRef: ref, content: `${title}${ref ? ` — ${ref}` : ''}\n${text}` })
  }

  for (const line of body.split('\n')) {
    const babMatch = /^\s*BAB\s+([IVXLCDM]+)\s*(.*)$/i.exec(line)
    const pasalMatch = /^\s*Pasal\s+(\d+)\s*$/i.exec(line)
    if (babMatch) {
      flush()
      bab = `Bab ${babMatch[1]}${babMatch[2] ? ` ${babMatch[2].trim()}` : ''}`
      pasal = null
      buffer.push(line.trim())
      continue
    }
    if (pasalMatch) {
      flush()
      pasal = `Pasal ${pasalMatch[1]}`
      buffer.push(line.trim())
      continue
    }
    buffer.push(line)
  }
  flush()
  return out
}

function daysAgo(days: number): Date {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() - days)
  return d
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function monthsFromToday(months: number): Date {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCMonth(d.getUTCMonth() + months)
  return d
}
