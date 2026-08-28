import { createHash, randomUUID } from 'node:crypto'
import type { PrismaClient } from '@prisma/client'

/**
 * Modul B demo dataset — applications, entitlements, one snapshot per
 * application, and a running review campaign.
 *
 * Shaped like a mid-size Indonesian securities firm on purpose. The point of a
 * demo is for the client to judge the system, and a fixture full of "App One /
 * Entitlement A" makes them judge the fixture instead. The segregation-of-duties
 * conflict below is the real one this module exists to catch: the same person
 * able to enter a settlement instruction and approve it.
 *
 * Idempotent, like the rest of the seed. It writes no audit entries for the
 * reasons given in seed.ts -- this is an operator data load, not a user action.
 */

interface Ctx {
  prisma: PrismaClient
  orgIds: Map<string, string>
  employeeIds: Map<string, string>
  userIds: Map<string, string>
}

/** Reviewed staff — the people whose access is under review, not the reviewers. */
const STAFF = [
  ['EMP-00341', 'Rudi Hartono', 'Staf Settlement', 'OPS'],
  ['EMP-00352', 'Nadia Putri', 'Analis Riset', 'RTL'],
  ['EMP-00367', 'Andi Setiawan', 'Analis Riset Junior', 'RTL'],
  ['EMP-00389', 'Budi Santoso', 'Staf Administrasi', 'OPS'],
  ['EMP-00401', 'Citra Maharani', 'Dealer Ritel', 'RTL'],
  ['EMP-00418', 'Eko Prasetyo', 'Staf Kustodian', 'OPS'],
  ['EMP-00426', 'Gita Ananda', 'Staf Kepegawaian', 'TI'],
  ['EMP-00437', 'Hadi Nurcahyo', 'Administrator Basis Data', 'TI'],
] as const

const APPLICATIONS = [
  {
    code: 'BACKOFFICE',
    name: 'Aplikasi Back Office Sekuritas',
    owner: 'EMP-00174', // Dewi Lestari, Kepala Operasional
    techOwner: 'EMP-00056', // Agus Santoso, Kepala Divisi TI
    criticality: 'KRITIS',
    hostingType: 'ON_PREMISE',
    reviewFrequency: 'TRIWULANAN',
  },
  {
    code: 'TRADING',
    name: 'Sistem Perdagangan Daring',
    owner: 'EMP-00174',
    techOwner: 'EMP-00056',
    criticality: 'KRITIS',
    hostingType: 'ON_PREMISE',
    reviewFrequency: 'TRIWULANAN',
  },
  {
    code: 'RISET',
    name: 'Portal Riset & Publikasi',
    owner: 'EMP-00238', // Fajar Nugroho
    techOwner: null,
    criticality: 'RENDAH',
    hostingType: 'SAAS',
    reviewFrequency: 'TAHUNAN',
  },
  {
    code: 'HRIS',
    name: 'Sistem Informasi Kepegawaian',
    owner: 'EMP-00056',
    techOwner: 'EMP-00056',
    criticality: 'SEDANG',
    hostingType: 'ON_PREMISE',
    reviewFrequency: 'SEMESTERAN',
  },
] as const

/**
 * The entitlement catalogue, with the non-technical descriptions FR-B-002
 * requires. These sentences are the reason a line manager can review at all --
 * "BO_SETTLE_APPROVE" tells them nothing about what they are approving.
 */
const ENTITLEMENTS = [
  {
    app: 'BACKOFFICE',
    code: 'BO_SETTLE_APPROVE',
    name: 'Settlement Approver',
    description:
      'Dapat menyetujui instruksi settlement transaksi efek, termasuk perpindahan dana dan efek antar-rekening nasabah.',
    type: 'PERAN',
    risk: 'KRITIS',
    privileged: true,
    financial: true,
  },
  {
    app: 'BACKOFFICE',
    code: 'BO_SETTLE_INPUT',
    name: 'Settlement Input',
    description: 'Dapat memasukkan instruksi settlement, tetapi tidak dapat menyetujuinya.',
    type: 'PERAN',
    risk: 'TINGGI',
    privileged: false,
    financial: true,
  },
  {
    app: 'BACKOFFICE',
    code: 'BO_REPORT_VIEW',
    name: 'Pembaca Laporan Back Office',
    description: 'Dapat membuka laporan settlement harian. Tidak dapat mengubah data apa pun.',
    type: 'PERAN',
    risk: 'RENDAH',
    privileged: false,
    financial: false,
  },
  {
    app: 'TRADING',
    code: 'TRD_ORDER_ENTRY',
    name: 'Order Entry',
    description: 'Dapat memasukkan order beli dan jual efek atas nama nasabah.',
    type: 'PERAN',
    risk: 'TINGGI',
    privileged: false,
    financial: true,
  },
  {
    app: 'TRADING',
    code: 'TRD_LIMIT_OVERRIDE',
    name: 'Pelampauan Batas Transaksi',
    description:
      'Dapat melampaui batas nilai transaksi harian nasabah tanpa persetujuan tambahan.',
    type: 'PERAN',
    risk: 'KRITIS',
    privileged: true,
    financial: true,
  },
  {
    app: 'RISET',
    code: 'RST_REPORT_VIEW',
    name: 'Pembaca Laporan Riset',
    description: 'Dapat membaca publikasi riset internal. Tidak dapat menerbitkan atau mengubah.',
    type: 'PERAN',
    risk: 'RENDAH',
    privileged: false,
    financial: false,
  },
  {
    app: 'HRIS',
    code: 'HR_EMPLOYEE_VIEW',
    name: 'Pembaca Data Karyawan',
    description: 'Dapat melihat data kepegawaian dasar: nama, jabatan, dan unit kerja.',
    type: 'PERAN',
    risk: 'RENDAH',
    privileged: false,
    financial: false,
  },
  {
    app: 'HRIS',
    code: 'HR_DBA',
    name: 'Administrator Basis Data Kepegawaian',
    description:
      'Akses langsung ke basis data kepegawaian, termasuk data gaji. Dapat mengubah data tanpa melalui aplikasi.',
    type: 'PERAN',
    risk: 'KRITIS',
    privileged: true,
    financial: false,
  },
] as const

/** Who holds what. The shape that produces the SoD conflict is deliberate. */
const HOLDINGS: readonly [string, string, string, string, string | null][] = [
  // [employeeNumber, applicationCode, entitlementCode, grantedAt, lastAccessAt]
  ['EMP-00341', 'BACKOFFICE', 'BO_SETTLE_APPROVE', '2024-02-15', '2026-08-25'],
  ['EMP-00341', 'TRADING', 'TRD_ORDER_ENTRY', '2023-06-01', '2026-08-26'],
  ['EMP-00341', 'BACKOFFICE', 'BO_REPORT_VIEW', '2023-06-01', '2026-08-20'],
  ['EMP-00418', 'BACKOFFICE', 'BO_SETTLE_INPUT', '2024-09-10', '2026-08-27'],
  ['EMP-00418', 'BACKOFFICE', 'BO_REPORT_VIEW', '2024-09-10', '2026-08-27'],
  ['EMP-00389', 'BACKOFFICE', 'BO_REPORT_VIEW', '2022-03-01', null],
  ['EMP-00401', 'TRADING', 'TRD_ORDER_ENTRY', '2023-01-20', '2026-08-27'],
  ['EMP-00401', 'TRADING', 'TRD_LIMIT_OVERRIDE', '2025-11-05', '2026-05-14'],
  ['EMP-00352', 'RISET', 'RST_REPORT_VIEW', '2024-04-11', '2026-08-22'],
  ['EMP-00367', 'RISET', 'RST_REPORT_VIEW', '2025-02-03', '2026-08-24'],
  ['EMP-00426', 'HRIS', 'HR_EMPLOYEE_VIEW', '2023-08-15', '2026-08-26'],
  ['EMP-00437', 'HRIS', 'HR_DBA', '2022-01-10', '2026-08-27'],
  ['EMP-00437', 'HRIS', 'HR_EMPLOYEE_VIEW', '2022-01-10', '2026-08-27'],
]

const SOD_RULES = [
  {
    code: 'SOD-01',
    name: 'Input dan persetujuan settlement oleh orang yang sama',
    riskDescription:
      'Satu orang dapat memasukkan sekaligus menyetujui instruksi settlement, sehingga perpindahan dana dan efek dapat terjadi tanpa pihak kedua yang memeriksa. Ini adalah jalur paling langsung menuju penyalahgunaan aset nasabah.',
    groupA: { entitlement_codes: ['TRD_ORDER_ENTRY', 'BO_SETTLE_INPUT'] },
    groupB: { entitlement_codes: ['BO_SETTLE_APPROVE'] },
    riskLevel: 'KRITIS',
  },
] as const

export async function seedModuleB(ctx: Ctx): Promise<void> {
  const { prisma, orgIds, employeeIds, userIds } = ctx

  for (const [employeeNumber, fullName, jobTitle, orgCode] of STAFF) {
    const existing = await prisma.employee.findUnique({ where: { employeeNumber } })
    const id = existing?.id ?? randomUUID()
    await prisma.employee.upsert({
      where: { employeeNumber },
      update: { fullName, jobTitle, orgUnitId: orgIds.get(orgCode)! },
      create: {
        id,
        employeeNumber,
        fullName,
        email: `${slug(fullName)}@trimegah.co.id`,
        jobTitle,
        orgUnitId: orgIds.get(orgCode)!,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2022-01-01'),
      },
    })
    employeeIds.set(employeeNumber, id)
  }

  const appIds = new Map<string, string>()
  for (const app of APPLICATIONS) {
    const existing = await prisma.application.findUnique({ where: { code: app.code } })
    const id = existing?.id ?? randomUUID()
    await prisma.application.upsert({
      where: { code: app.code },
      update: {
        name: app.name,
        ownerEmployeeId: employeeIds.get(app.owner)!,
        techOwnerEmployeeId: app.techOwner ? employeeIds.get(app.techOwner)! : null,
      },
      create: {
        id,
        code: app.code,
        name: app.name,
        ownerEmployeeId: employeeIds.get(app.owner)!,
        techOwnerEmployeeId: app.techOwner ? employeeIds.get(app.techOwner)! : null,
        criticality: app.criticality,
        hostingType: app.hostingType,
        reviewFrequency: app.reviewFrequency,
      },
    })
    appIds.set(app.code, id)
  }

  const entIds = new Map<string, string>()
  for (const ent of ENTITLEMENTS) {
    const applicationId = appIds.get(ent.app)!
    const existing = await prisma.entitlementCatalog.findUnique({
      where: { applicationId_technicalCode: { applicationId, technicalCode: ent.code } },
    })
    const id = existing?.id ?? randomUUID()
    await prisma.entitlementCatalog.upsert({
      where: { applicationId_technicalCode: { applicationId, technicalCode: ent.code } },
      update: { displayName: ent.name, businessDescription: ent.description },
      create: {
        id,
        applicationId,
        technicalCode: ent.code,
        displayName: ent.name,
        businessDescription: ent.description,
        entitlementType: ent.type,
        riskLevel: ent.risk,
        isPrivileged: ent.privileged,
        isFinancial: ent.financial,
        // FR-B-002: a description written means the entitlement is categorised.
        isCategorized: true,
      },
    })
    entIds.set(ent.code, id)
  }

  for (const rule of SOD_RULES) {
    const existing = await prisma.sodRule.findUnique({ where: { code: rule.code } })
    await prisma.sodRule.upsert({
      where: { code: rule.code },
      update: { name: rule.name, riskDescription: rule.riskDescription },
      create: {
        id: existing?.id ?? randomUUID(),
        code: rule.code,
        name: rule.name,
        riskDescription: rule.riskDescription,
        groupA: rule.groupA,
        groupB: rule.groupB,
        riskLevel: rule.riskLevel,
      },
    })
  }

  // One snapshot per application, all taken on the same day so the campaign has
  // a coherent "as at" date. capturedAt is inside a 2026 partition; the
  // migration created partitions for 2026 only.
  const capturedAt = new Date('2026-08-27T18:00:00.000Z')
  const snapshotIds = new Map<string, string>()
  const lineIds = new Map<string, string>() // `${employeeNumber}:${entitlementCode}`

  for (const app of APPLICATIONS) {
    const applicationId = appIds.get(app.code)!
    const holdings = HOLDINGS.filter(([, code]) => code === app.code)

    const existing = await prisma.accessSnapshot.findFirst({
      where: { applicationId, capturedAt },
      select: { id: true },
    })

    if (existing) {
      snapshotIds.set(app.code, existing.id)
      const lines = await prisma.snapshotLine.findMany({
        where: { snapshotId: existing.id },
        select: { id: true, employeeId: true, entitlementId: true },
      })
      for (const line of lines) {
        const empNo = [...employeeIds.entries()].find(([, v]) => v === line.employeeId)?.[0]
        const entCode = [...entIds.entries()].find(([, v]) => v === line.entitlementId)?.[0]
        if (empNo && entCode) lineIds.set(`${empNo}:${entCode}`, line.id)
      }
      continue
    }

    const snapshotId = randomUUID()
    await prisma.accessSnapshot.create({
      data: {
        id: snapshotId,
        applicationId,
        capturedAt,
        source: 'MANUAL',
        identityCount: new Set(holdings.map(([emp]) => emp)).size,
        entitlementCount: holdings.length,
        // FR-B-005 rule 1: a fingerprint over the snapshot content, computed
        // once every line is known. Here that is the fixture itself.
        contentHash: createHash('sha256').update(JSON.stringify(holdings)).digest('hex'),
        status: 'SELESAI',
      },
    })
    snapshotIds.set(app.code, snapshotId)

    for (const [empNo, , entCode, grantedAt, lastAccess] of holdings) {
      const lineId = randomUUID()
      await prisma.snapshotLine.create({
        data: {
          id: lineId,
          snapshotId,
          // Denormalised from the parent snapshot: it is the partition key, and
          // the invariant "equal to access_snapshot.captured_at" is the
          // application's to hold (migration Sec 7).
          capturedAt,
          accountId: accountFor(empNo),
          accountName: null,
          entitlementId: entIds.get(entCode)!,
          employeeId: employeeIds.get(empNo)!,
          accountStatus: 'AKTIF',
          lastAccessAt: lastAccess ? new Date(`${lastAccess}T10:00:00.000Z`) : null,
          grantedAt: new Date(grantedAt),
          grantedBy: `admin.${app.code.toLowerCase()}`,
        },
      })
      lineIds.set(`${empNo}:${entCode}`, lineId)
    }
  }

  // The SoD conflict FR-B-024 detects: Rudi holds Order Entry (group A) and
  // Settlement Approver (group B). Detection itself is not built yet, so the
  // finding is seeded -- the screen must show the reviewer a real conflict.
  const sodRule = await prisma.sodRule.findUniqueOrThrow({ where: { code: 'SOD-01' } })
  const existingViolation = await prisma.sodViolation.findFirst({
    where: { ruleId: sodRule.id, employeeId: employeeIds.get('EMP-00341')!, status: 'TERBUKA' },
  })
  if (!existingViolation) {
    await prisma.sodViolation.create({
      data: {
        id: randomUUID(),
        ruleId: sodRule.id,
        employeeId: employeeIds.get('EMP-00341')!,
        entitlementIdA: entIds.get('TRD_ORDER_ENTRY')!,
        entitlementIdB: entIds.get('BO_SETTLE_APPROVE')!,
        detectedInSnapshotId: snapshotIds.get('BACKOFFICE')!,
        status: 'TERBUKA',
      },
    })
  }

  await seedCampaign({ prisma, appIds, entIds, employeeIds, userIds, lineIds })
}

/**
 * One running campaign covering all four applications.
 *
 * Items are routed to the application owner, which is the rule the fixture
 * declares in `reviewerRule`. The campaign builder (FR-B-008 s.d. FR-B-010) that
 * would apply that rule for real is not built yet; this seeds the result it
 * would produce, so the reviewer screen has something to review.
 */
async function seedCampaign(args: {
  prisma: PrismaClient
  appIds: Map<string, string>
  entIds: Map<string, string>
  employeeIds: Map<string, string>
  userIds: Map<string, string>
  lineIds: Map<string, string>
}): Promise<void> {
  const { prisma, appIds, employeeIds, userIds, lineIds } = args

  const code = 'UAR-2026-S2'
  const existing = await prisma.reviewCampaign.findUnique({ where: { code } })
  if (existing) return

  const campaignId = randomUUID()
  await prisma.reviewCampaign.create({
    data: {
      id: campaignId,
      code,
      name: 'Review Hak Akses Semester II 2026',
      campaignType: 'PERIODIK',
      startDate: new Date('2026-08-28'),
      dueDate: new Date('2026-09-15'),
      reviewerRule: { type: 'APP_OWNER', fallback: 'SEC_OFFICER' },
      fallbackReviewerId: userIds.get('rina.kusuma')!,
      status: 'BERJALAN',
    },
  })

  // Which user reviews which application. Both hold APP_OWNER, so both have
  // review:decide and campaign:signoff.
  const reviewerByApp: Record<string, string> = {
    BACKOFFICE: userIds.get('dewi.lestari')!,
    TRADING: userIds.get('dewi.lestari')!,
    RISET: userIds.get('fajar.nugroho')!,
    HRIS: userIds.get('agus.santoso')!,
  }

  for (const app of APPLICATIONS) {
    const holdings = HOLDINGS.filter(([, appCode]) => appCode === app.code)
    await prisma.campaignScope.create({
      data: {
        id: randomUUID(),
        campaignId,
        applicationId: appIds.get(app.code)!,
        scopeFilter: {},
        itemCount: holdings.length,
      },
    })

    for (const [empNo, , entCode] of holdings) {
      const snapshotLineId = lineIds.get(`${empNo}:${entCode}`)
      if (!snapshotLineId) continue
      await prisma.reviewItem.create({
        data: {
          id: randomUUID(),
          campaignId,
          snapshotLineId,
          reviewerId: reviewerByApp[app.code]!,
          layerNo: 1,
          status: 'BELUM_DIPUTUSKAN',
          isFlagged: false,
        },
      })
    }
  }

  void employeeIds
}

function accountFor(employeeNumber: string): string {
  return `u-${employeeNumber.replace('EMP-', '')}`
}

function slug(fullName: string): string {
  return fullName.toLowerCase().replace(/\s+/g, '.')
}
