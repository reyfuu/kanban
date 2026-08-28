import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { LlmGatewayService } from '../src/modules/shared/llm-gateway/llm-gateway.service.js'
import { LlmProvider, type LlmAnswer, type LlmPrompt } from '../src/modules/shared/llm-gateway/llm-provider.js'
import type { Chunk } from '../src/modules/shared/llm-gateway/classification-gate.js'

/**
 * ADR-03 · the gateway, against the real database.
 *
 * The provider here is a recording stub, and that is the whole point of the
 * test: the only way to prove the classification gate works is to look at what
 * the provider ACTUALLY RECEIVED. A test that asserts on the gateway's return
 * value would pass just as happily if restricted text were forwarded and then
 * omitted from the reply.
 *
 * So the stub keeps every payload it was handed, and the assertions read that
 * -- the same position an egress proxy would occupy.
 */

class RecordingProvider extends LlmProvider {
  readonly name = 'UJI'
  readonly received: LlmPrompt[] = []
  /** What to answer with. Citations are set per test. */
  citations: string[] = []
  shouldThrow = false

  generate(prompt: LlmPrompt): Promise<LlmAnswer> {
    this.received.push(prompt)
    if (this.shouldThrow) return Promise.reject(new Error('penyedia tumbang'))
    return Promise.resolve({
      text: 'Jawaban uji.',
      citations: this.citations,
      tokensPrompt: 10,
      tokensCompletion: 5,
      costMicros: 1_000n,
    })
  }

  /** Everything the provider was ever shown, as one string. */
  allText(): string {
    return JSON.stringify(this.received)
  }
}

const prisma = new PrismaService()
const provider = new RecordingProvider()
const gateway = new LlmGatewayService(prisma, provider)

const ids = {
  orgUnit: randomUUID(),
  employee: randomUUID(),
  user: randomUUID(),
}
const suffix = ids.user.slice(0, 8)

const chunk = (
  id: string,
  classification: Chunk['classification'],
  text = 'Isi potongan biasa.',
): Chunk => ({
  id,
  documentId: `doc-${id}`,
  documentTitle: 'SOP Pengendalian Akses',
  versionLabel: '2.1',
  sectionNo: '4.3',
  text,
  classification,
})

/*
 * The settings row is a singleton shared with the running dev deployment, so
 * this suite mutates state it does not own. Restoring `enabled: false` is not
 * enough: leaving "Dinonaktifkan untuk pengujian." behind means the live
 * /llm-gateway/status endpoint tells a Compliance Officer the feature is off
 * for testing, when the real reason is that ADR-03's G1-G7 preconditions have
 * never been verified. A misleading reason on a control surface is worse than
 * no reason at all, so the original row is captured and put back.
 */
let originalSetting: {
  enabled: boolean
  disabledReason: string | null
  maxRequestsPerUserPerHour: number
} | null = null

async function setGateway(enabled: boolean, budgetPerHour = 20) {
  const row = await prisma.llmGatewaySetting.findFirst({ select: { id: true } })
  await prisma.llmGatewaySetting.update({
    where: { id: row!.id },
    data: {
      enabled,
      disabledReason: enabled ? null : 'Dinonaktifkan untuk pengujian.',
      maxRequestsPerUserPerHour: budgetPerHour,
    },
  })
}

beforeAll(async () => {
  await prisma.$connect()

  const current = await prisma.llmGatewaySetting.findFirst({
    select: { enabled: true, disabledReason: true, maxRequestsPerUserPerHour: true },
  })
  originalSetting = current ?? null

  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OUL-${suffix}`, name: 'Unit Uji Gerbang' },
  })
  await prisma.employee.create({
    data: {
      id: ids.employee,
      employeeNumber: `EML-${suffix}`,
      fullName: 'Penanya Uji',
      email: `llm-${suffix}@contoh.internal`,
      jobTitle: 'Analis',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2022-01-01'),
    },
  })
  await prisma.appUser.create({
    data: { id: ids.user, employeeId: ids.employee, externalId: `llm-${suffix}`, userType: 'INTERNAL' },
  })
})

/*
 * The gateway log cannot be deleted, by design: the migration grants
 * sigap_app SELECT/INSERT/UPDATE and no DELETE, for the same reason audit_log
 * has none (K-7). A record of what left the company that the application can
 * quietly remove is not evidence of anything.
 *
 * That surfaced here as every test failing on cleanup, which is the control
 * working. So each test reads only rows created after its own start mark
 * instead of clearing the table.
 */
let mark: Date

beforeEach(async () => {
  provider.received.length = 0
  provider.shouldThrow = false
  mark = new Date()
  // Postgres timestamps and JS clocks can land on the same millisecond; a
  // millisecond of slack keeps the boundary from swallowing a row.
  await new Promise((r) => setTimeout(r, 2))
})

/** The row this test produced. */
async function logRow(outcome?: string) {
  return prisma.llmRequestLog.findFirst({
    where: {
      askedByUserId: ids.user,
      occurredAt: { gte: mark },
      ...(outcome ? { outcome: outcome as never } : {}),
    },
    orderBy: { occurredAt: 'desc' },
  })
}

afterAll(async () => {
  // Put the row back exactly as found, reason text included.
  const row = await prisma.llmGatewaySetting.findFirst({ select: { id: true } })
  if (row && originalSetting) {
    await prisma.llmGatewaySetting.update({ where: { id: row.id }, data: originalSetting })
  }
  try {
    await prisma.appUser.deleteMany({ where: { id: ids.user } })
    await prisma.employee.deleteMany({ where: { id: ids.employee } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the gateway log and the audit trail, neither of which the
    // application may delete from. The rows stay, correctly (K-7).
  }
  await prisma.$disconnect()
})

describe('FR-C-017 · pemutus layanan', () => {
  it('bawaan penempatan baru adalah NONAKTIF', async () => {
    // ADR-03 G1-G7 harus diverifikasi Kepatuhan sebelum jalur keluar dibuka.
    // Penempatan baru yang langsung mengirim data ke penyedia eksternal sebelum
    // ada yang memeriksanya adalah kegagalan yang tidak bisa ditarik kembali.
    await setGateway(false)
    const res = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa kebijakan akses?',
      chunks: [chunk('c1', 'PUBLIK')],
    })
    expect(res.status).toBe('TIDAK_TERSEDIA')
    expect(provider.received).toHaveLength(0)
  })

  it('penolakan pemutus tetap tercatat', async () => {
    await setGateway(false)
    await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa kebijakan akses?',
      chunks: [chunk('c1', 'PUBLIK')],
    })
    const row = await logRow()
    expect(row?.outcome).toBe('DITOLAK_PEMUTUS')
    expect(row?.refusalReason).toBeTruthy()
  })
})

describe('FR-C-014 · gerbang klasifikasi terhadap muatan yang BENAR-BENAR dikirim', () => {
  it('seluruhnya Rahasia: penyedia tidak pernah dipanggil', async () => {
    await setGateway(true)
    const res = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Ringkas dokumen rahasia ini.',
      chunks: [chunk('r1', 'RAHASIA'), chunk('r2', 'TERBATAS')],
    })
    expect(res.status).toBe('TIDAK_TERSEDIA')
    expect(provider.received).toHaveLength(0)

    const row = await logRow()
    expect(row?.outcome).toBe('DITOLAK_KLASIFIKASI')
  })

  it('sebagian tinggi: teks Rahasia TIDAK PERNAH sampai ke penyedia', async () => {
    // Inti seluruh ADR-03. Diperiksa dari sisi penyedia, bukan dari nilai
    // kembalian: kalau teksnya terkirim lalu tidak ditampilkan, datanya tetap
    // sudah meninggalkan kendali perusahaan.
    await setGateway(true)
    provider.citations = ['boleh']

    await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [
        chunk('boleh', 'INTERNAL', 'Prosedur umum yang boleh dibagikan.'),
        chunk('rahasia', 'RAHASIA', 'RAHASIA_JANGAN_KELUAR_12345'),
      ],
    })

    expect(provider.received).toHaveLength(1)
    expect(provider.allText()).not.toContain('RAHASIA_JANGAN_KELUAR')
    expect(provider.allText()).toContain('Prosedur umum')
  })

  it('jawaban sebagian ditandai kepada pembacanya', async () => {
    await setGateway(true)
    provider.citations = ['boleh']
    const res = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [chunk('boleh', 'INTERNAL'), chunk('rahasia', 'RAHASIA')],
    })
    expect(res.status).toBe('JAWABAN')
    if (res.status === 'JAWABAN') {
      expect(res.partial).toBe(true)
      expect(res.notice).toContain('tidak disertakan')
    }
  })
})

describe('FR-C-015 · redaksi pada muatan yang dikirim', () => {
  it('NIK di dalam dokumen tidak sampai ke penyedia', async () => {
    await setGateway(true)
    provider.citations = ['c1']
    await gateway.ask({
      askedByUserId: ids.user,
      question: 'Siapa pemohonnya?',
      chunks: [chunk('c1', 'INTERNAL', 'Pemohon dengan NIK 3273010101900001 disetujui.')],
    })
    expect(provider.allText()).not.toContain('3273010101900001')
    expect(provider.allText()).toContain('[NIK]')
  })

  it('aturan 4 · PERTANYAAN pengguna juga diredaksi', async () => {
    // Pengguna bisa menempelkan nomor rekening nasabah ke kotak pencarian.
    // Gerbang yang hanya membersihkan dokumen akan mengirimkannya apa adanya.
    await setGateway(true)
    provider.citations = ['c1']
    await gateway.ask({
      askedByUserId: ids.user,
      question: 'Cek rekening 1234567890123 milik siapa?',
      chunks: [chunk('c1', 'INTERNAL')],
    })
    expect(provider.allText()).not.toContain('1234567890123')
  })
})

describe('ADR-03 K10 · rujukan wajib', () => {
  it('jawaban tanpa rujukan yang dapat diverifikasi DIBUANG', async () => {
    await setGateway(true)
    provider.citations = []
    const res = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [chunk('c1', 'INTERNAL')],
    })
    expect(res.status).toBe('TIDAK_TERSEDIA')

    const row = await logRow()
    expect(row?.outcome).toBe('DITOLAK_TANPA_RUJUKAN')
  })

  it('rujukan yang DIKARANG penyedia ditolak, bukan diteruskan', async () => {
    // Rujukan palsu lebih berbahaya daripada tidak ada jawaban sama sekali: ia
    // membawa penampakan bersumber, sehingga pembacanya berhenti memeriksa.
    await setGateway(true)
    provider.citations = ['potongan-yang-tidak-pernah-dikirim']
    const res = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [chunk('c1', 'INTERNAL')],
    })
    expect(res.status).toBe('TIDAK_TERSEDIA')
  })

  it('rujukan sah menghasilkan jawaban dengan dokumen, versi, dan bagian', async () => {
    await setGateway(true)
    provider.citations = ['c1']
    const res = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [chunk('c1', 'INTERNAL')],
    })
    expect(res.status).toBe('JAWABAN')
    if (res.status === 'JAWABAN') {
      // FR-C-013 aturan 2 · nama dokumen, versi, dan nomor bagian.
      expect(res.citations[0]?.documentTitle).toBe('SOP Pengendalian Akses')
      expect(res.citations[0]?.versionLabel).toBe('2.1')
      expect(res.citations[0]?.sectionNo).toBe('4.3')
      expect(res.notice).toContain('mengikat')
    }
  })
})

describe('FR-C-016 · pencatatan gerbang', () => {
  it('muatan dicatat SEBELUM dikirim, sehingga penyedia yang tumbang tetap meninggalkan jejak', async () => {
    // Kalau pencatatan dilakukan setelah panggilan, kegagalan di tengah jalan
    // menyisakan data yang sudah keluar tanpa catatan bahwa ia pernah keluar.
    await setGateway(true)
    provider.shouldThrow = true

    const res = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [chunk('c1', 'INTERNAL')],
    })
    expect(res.status).toBe('TIDAK_TERSEDIA')

    const row = await logRow()
    expect(row?.outcome).toBe('GAGAL_PENYEDIA')
    expect(row?.payloadSent, 'muatan harus sudah tercatat sebelum panggilan').not.toBeNull()
  })

  it('mencatat token, biaya, dan lama proses pada permintaan yang berhasil', async () => {
    await setGateway(true)
    provider.citations = ['c1']
    await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [chunk('c1', 'INTERNAL')],
    })
    const row = await logRow()
    expect(row?.tokensPrompt).toBe(10)
    expect(row?.costMicros).toBe(1_000n)
    expect(row?.durationMs).not.toBeNull()
  })

  it('catatan menyimpan klasifikasi potongan, tetapi TIDAK teksnya', async () => {
    // Menyalin teks dokumen terbatas ke tabel kedua akan meniadakan gerbang
    // klasifikasi lewat jalan lain.
    await setGateway(true)
    provider.citations = ['c1']
    await gateway.ask({
      askedByUserId: ids.user,
      question: 'Apa aturannya?',
      chunks: [chunk('c1', 'INTERNAL', 'TEKS_POTONGAN_RAHASIA_UNIK')],
    })
    const row = await logRow()
    const summary = JSON.stringify(row?.chunksReferenced)
    expect(summary).toContain('INTERNAL')
    expect(summary).not.toContain('TEKS_POTONGAN_RAHASIA_UNIK')
  })
})

describe('ADR-03 K8 · batas laju', () => {
  it('melampaui batas per jam ditolak dan dicatat', async () => {
    await setGateway(true, 1)
    provider.citations = ['c1']

    await gateway.ask({
      askedByUserId: ids.user,
      question: 'Pertama',
      chunks: [chunk('c1', 'INTERNAL')],
    })
    const second = await gateway.ask({
      askedByUserId: ids.user,
      question: 'Kedua',
      chunks: [chunk('c1', 'INTERNAL')],
    })

    expect(second.status).toBe('TIDAK_TERSEDIA')
    const row = await logRow('DITOLAK_BATAS')
    expect(row).not.toBeNull()
  })
})
