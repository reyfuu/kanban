import { randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

/**
 * Modul A demo dataset — control library, one framework, and a mapping that
 * leaves a visible coverage gap.
 *
 * Shaped like a real securities-firm control set, small but honest: a few ITGC
 * controls, an ISO/IEC 27001:2022 Annex A subset with real clause refs, and
 * mappings that cover some clauses fully, some partially, and leave one
 * uncovered on purpose. The uncovered clause is the point — the coverage view
 * (FR-A-003 aturan 4) exists to surface exactly that, and a demo where
 * everything is covered proves nothing.
 *
 * Idempotent like the rest of the seed, and writes no audit entries: this is an
 * operator data load, not a user action (same reasoning as seed.ts).
 */

interface Ctx {
  prisma: PrismaClient
  employeeIds: Map<string, string>
  orgIds: Map<string, string>
  userIds: Map<string, string>
}

/** Controls owned by real seeded people. Owner is an employee number. */
const CONTROLS = [
  {
    code: 'ITGC-AC-02',
    title: 'Review hak akses pengguna secara berkala',
    objective:
      'Memastikan hak akses pengguna pada aplikasi kritis ditinjau dan disetujui secara berkala oleh pihak yang berwenang.',
    owner: 'EMP-00211', // Rina Kusuma, SEC_OFFICER
    orgCode: 'TI',
    frequency: 'TRIWULANAN' as const,
    controlType: 'DETEKTIF' as const,
    nature: 'SEMI_OTOMATIS' as const,
    riskLevel: 'TINGGI' as const,
    testProcedure:
      'Ambil sampel kampanye review pada periode audit. Verifikasi kelengkapan cakupan, keberadaan sign-off, dan penutupan tiket pencabutan.',
    expectedEvidenceTypes: ['PAKET_BUKTI_KAMPANYE', 'TANGKAPAN_LAYAR', 'LAPORAN_SISTEM'],
  },
  {
    code: 'ITGC-CM-01',
    title: 'Persetujuan perubahan aplikasi produksi',
    objective:
      'Memastikan setiap perubahan pada aplikasi produksi melalui persetujuan berjenjang sebelum diterapkan.',
    owner: 'EMP-00056', // Agus Santoso, Kepala Divisi TI
    orgCode: 'TI',
    frequency: 'AD_HOC' as const,
    controlType: 'PREVENTIF' as const,
    nature: 'MANUAL' as const,
    riskLevel: 'TINGGI' as const,
    testProcedure:
      'Ambil sampel tiket perubahan pada periode audit. Verifikasi persetujuan pemisahan tugas antara pengembang dan pihak yang menerapkan ke produksi.',
    expectedEvidenceTypes: ['TIKET_PERUBAHAN', 'LOG_PERSETUJUAN'],
  },
  {
    code: 'ITGC-BK-01',
    title: 'Pencadangan dan uji pemulihan data',
    objective:
      'Memastikan data kritis dicadangkan secara berkala dan pemulihannya diuji agar dapat diandalkan saat gangguan.',
    owner: 'EMP-00056',
    orgCode: 'TI',
    frequency: 'BULANAN' as const,
    controlType: 'KOREKTIF' as const,
    nature: 'OTOMATIS' as const,
    riskLevel: 'SEDANG' as const,
    testProcedure:
      'Verifikasi keberhasilan pencadangan harian dan hasil uji pemulihan bulanan terakhir.',
    expectedEvidenceTypes: ['LAPORAN_SISTEM', 'BERITA_ACARA_UJI'],
  },
] as const

/**
 * A subset of ISO/IEC 27001:2022 Annex A, with real clause refs. Two headings
 * (A.5, A.8) and their leaves; the leaves are what coverage counts.
 */
const ISO_ITEMS = [
  { ref: 'A.5', title: 'Organizational controls', parentRef: null, sort: 1 },
  { ref: 'A.5.15', title: 'Access control', parentRef: 'A.5', sort: 2 },
  { ref: 'A.5.18', title: 'Access rights', parentRef: 'A.5', sort: 3 },
  { ref: 'A.8', title: 'Technological controls', parentRef: null, sort: 4 },
  { ref: 'A.8.13', title: 'Information backup', parentRef: 'A.8', sort: 5 },
  { ref: 'A.8.16', title: 'Monitoring activities', parentRef: 'A.8', sort: 6 },
  { ref: 'A.8.32', title: 'Change management', parentRef: 'A.8', sort: 7 },
] as const

/**
 * Mappings that leave A.8.16 (Monitoring activities) uncovered on purpose. The
 * coverage view must show it as TIDAK_TERTUTUP.
 */
const MAPPINGS = [
  { control: 'ITGC-AC-02', item: 'A.5.18', level: 'PENUH' as const },
  { control: 'ITGC-AC-02', item: 'A.5.15', level: 'SEBAGIAN' as const },
  { control: 'ITGC-CM-01', item: 'A.8.32', level: 'PENUH' as const },
  { control: 'ITGC-BK-01', item: 'A.8.13', level: 'PENUH' as const },
  // A.8.16 intentionally unmapped -> a visible gap in the coverage view.
] as const

export async function seedModuleA(ctx: Ctx): Promise<void> {
  const { prisma, employeeIds, orgIds, userIds } = ctx

  // The mapping author and version author: an internal auditor.
  const auditorUserId = userIds.get('sari.dewi') ?? userIds.get('bayu.pratama')
  if (!auditorUserId) return // no auditor seeded, nothing to attribute writes to

  const controlIds = new Map<string, string>()
  for (const c of CONTROLS) {
    const existing = await prisma.control.findUnique({ where: { code: c.code } })
    const id = existing?.id ?? randomUUID()
    await prisma.control.upsert({
      where: { code: c.code },
      update: { title: c.title, objective: c.objective },
      create: {
        id,
        code: c.code,
        title: c.title,
        objective: c.objective,
        ownerEmployeeId: employeeIds.get(c.owner)!,
        executingOrgUnitId: orgIds.get(c.orgCode) ?? null,
        frequency: c.frequency,
        controlType: c.controlType,
        nature: c.nature,
        riskLevel: c.riskLevel,
        testProcedure: c.testProcedure,
        expectedEvidenceTypes: [...c.expectedEvidenceTypes],
        currentVersion: 1,
      },
    })
    controlIds.set(c.code, id)

    // Version 1 snapshot, idempotent.
    const hasVersion = await prisma.controlVersion.findFirst({
      where: { controlId: id, versionNo: 1 },
      select: { id: true },
    })
    if (!hasVersion) {
      await prisma.controlVersion.create({
        data: {
          id: randomUUID(),
          controlId: id,
          versionNo: 1,
          title: c.title,
          objective: c.objective,
          frequency: c.frequency,
          controlType: c.controlType,
          nature: c.nature,
          riskLevel: c.riskLevel,
          testProcedure: c.testProcedure,
          snapshot: { code: c.code, expected_evidence_types: [...c.expectedEvidenceTypes] },
          changedBy: auditorUserId,
        },
      })
    }
  }

  // One framework: ISO 27001.
  const frameworkCode = 'ISO27001-2022'
  const existingFw = await prisma.framework.findUnique({ where: { code: frameworkCode } })
  const frameworkId = existingFw?.id ?? randomUUID()
  await prisma.framework.upsert({
    where: { code: frameworkCode },
    update: { name: 'ISO/IEC 27001:2022 Annex A' },
    create: {
      id: frameworkId,
      code: frameworkCode,
      name: 'ISO/IEC 27001:2022 Annex A',
      description: 'Subset Annex A untuk demo pustaka kontrol.',
    },
  })

  const itemIds = new Map<string, string>()
  // Pass 1: create items.
  for (const it of ISO_ITEMS) {
    const existing = await prisma.frameworkItem.findFirst({
      where: { frameworkId, ref: it.ref },
      select: { id: true },
    })
    const id = existing?.id ?? randomUUID()
    if (!existing) {
      await prisma.frameworkItem.create({
        data: { id, frameworkId, ref: it.ref, title: it.title, sortOrder: it.sort },
      })
    }
    itemIds.set(it.ref, id)
  }
  // Pass 2: wire parents.
  for (const it of ISO_ITEMS) {
    if (!it.parentRef) continue
    await prisma.frameworkItem.update({
      where: { id: itemIds.get(it.ref)! },
      data: { parentId: itemIds.get(it.parentRef)! },
    })
  }

  // Mappings, idempotent on (control, item).
  for (const m of MAPPINGS) {
    const controlId = controlIds.get(m.control)!
    const frameworkItemId = itemIds.get(m.item)!
    const existing = await prisma.controlMapping.findUnique({
      where: { controlId_frameworkItemId: { controlId, frameworkItemId } },
      select: { id: true },
    })
    if (!existing) {
      await prisma.controlMapping.create({
        data: {
          id: randomUUID(),
          controlId,
          frameworkItemId,
          coverageLevel: m.level,
          mappedBy: auditorUserId,
        },
      })
    }
  }
}
