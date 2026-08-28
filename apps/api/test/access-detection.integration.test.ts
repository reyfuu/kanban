import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { SnapshotUploadService } from '../src/modules/access/snapshot-upload.service.js'
import { SnapshotStagingStore } from '../src/modules/access/snapshot-staging.store.js'
import { DetectionService } from '../src/modules/access/detection.service.js'
import { AnomalyService } from '../src/modules/access/anomaly.service.js'
import { SodService } from '../src/modules/access/sod.service.js'

/**
 * FR-B-007 (anomalies) and FR-B-024 (SoD), against the real database.
 *
 * The pure rules are unit-tested in access-detection.test.ts. What this file
 * covers is what a unit test cannot: that detection runs on a committed
 * snapshot, that findings persist, that a reappearing finding is carried
 * forward rather than duplicated (FR-B-007 aturan 3), that the cross-application
 * SoD conflict is raised from two applications' snapshots, and that the read and
 * exception paths behave.
 */
const prisma = new PrismaService()
const staging = new SnapshotStagingStore()
const uow = new UnitOfWork(prisma)
const uploads = new SnapshotUploadService(prisma, uow, staging)
const detection = new DetectionService(prisma, uow)
const anomalyService = new AnomalyService(prisma, uow)
const sodService = new SodService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  activeEmp: randomUUID(),
  termEmp: randomUUID(),
  crossEmp: randomUUID(),
  user: randomUUID(),
  appA: randomUUID(),
  appB: randomUUID(),
  entOrder: randomUUID(), // app A, group A
  entApprove: randomUUID(), // app B, group B
  entView: randomUUID(), // app A, neutral
  sodRule: randomUUID(),
}

const suffix = ids.appA.slice(0, 8)
let principal: Principal
const createdSnapshots: string[] = []

async function asUser<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(
    {
      requestId: randomUUID(),
      actorId: ids.user,
      actorRoles: ['SEC_OFFICER'],
      sessionId: null,
      ipAddress: '127.0.0.1',
    },
    fn,
  )
}

function file(body: string) {
  return { originalname: 'akses.csv', size: Buffer.byteLength(body), buffer: Buffer.from(body) }
}

/** Ingest into a named application and run detection, returning the snapshot id. */
async function ingest(applicationId: string, body: string): Promise<string> {
  return asUser(async () => {
    const preview = await uploads.validate(principal, applicationId, file(body))
    const result = await uploads.commit(principal, {
      validationId: preview.validationId,
      skipInvalidRows: true,
      confirmWarnings: ['ROW_COUNT_DROP'],
    })
    createdSnapshots.push(result.snapshotId)
    await detection.runForSnapshot(result.snapshotId)
    return result.snapshotId
  })
}

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OU-${suffix}`, name: 'Unit Uji Deteksi' },
  })

  await prisma.employee.createMany({
    data: [
      {
        id: ids.activeEmp,
        employeeNumber: `EA-${suffix}`,
        fullName: 'Karyawan Aktif',
        email: `active-${suffix}@contoh.internal`,
        jobTitle: 'Staf',
        orgUnitId: ids.orgUnit,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2024-01-01'),
      },
      {
        id: ids.termEmp,
        employeeNumber: `ET-${suffix}`,
        fullName: 'Karyawan Nonaktif',
        email: `term-${suffix}@contoh.internal`,
        jobTitle: 'Staf',
        orgUnitId: ids.orgUnit,
        employmentStatus: 'TIDAK_AKTIF',
        joinedAt: new Date('2022-01-01'),
        terminatedAt: new Date('2026-06-30'),
      },
      {
        id: ids.crossEmp,
        employeeNumber: `EC-${suffix}`,
        fullName: 'Karyawan Lintas',
        email: `cross-${suffix}@contoh.internal`,
        jobTitle: 'Staf Settlement',
        orgUnitId: ids.orgUnit,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2023-01-01'),
      },
    ],
  })

  await prisma.appUser.create({
    data: { id: ids.user, employeeId: ids.activeEmp, externalId: `sec-${suffix}`, userType: 'INTERNAL' },
  })

  await prisma.application.createMany({
    data: [
      {
        id: ids.appA,
        code: `UJA-${suffix}`,
        name: 'Aplikasi Uji A',
        ownerEmployeeId: ids.activeEmp,
        criticality: 'TINGGI',
        hostingType: 'ON_PREMISE',
        reviewFrequency: 'TAHUNAN',
      },
      {
        id: ids.appB,
        code: `UJB-${suffix}`,
        name: 'Aplikasi Uji B',
        ownerEmployeeId: ids.activeEmp,
        criticality: 'TINGGI',
        hostingType: 'ON_PREMISE',
        reviewFrequency: 'TAHUNAN',
      },
    ],
  })

  await prisma.entitlementCatalog.createMany({
    data: [
      {
        id: ids.entOrder,
        applicationId: ids.appA,
        technicalCode: `ORDER_${suffix}`,
        displayName: 'Order Entry Uji',
        entitlementType: 'PERAN',
        riskLevel: 'TINGGI',
      },
      {
        id: ids.entView,
        applicationId: ids.appA,
        technicalCode: `VIEW_${suffix}`,
        displayName: 'Pembaca Uji',
        entitlementType: 'PERAN',
        riskLevel: 'RENDAH',
      },
      {
        id: ids.entApprove,
        applicationId: ids.appB,
        technicalCode: `APPROVE_${suffix}`,
        displayName: 'Approver Uji',
        entitlementType: 'PERAN',
        riskLevel: 'KRITIS',
        isPrivileged: true,
      },
    ],
  })

  // A rule whose two groups sit in different applications (FR-B-024 aturan 1).
  await prisma.sodRule.create({
    data: {
      id: ids.sodRule,
      code: `SOD-UJI-${suffix}`,
      name: 'Order vs Approve lintas aplikasi (uji)',
      riskDescription: 'Uji konflik SoD lintas aplikasi.',
      groupA: { entitlement_ids: [ids.entOrder] },
      groupB: { entitlement_ids: [ids.entApprove] },
      riskLevel: 'KRITIS',
    },
  })

  principal = {
    userId: ids.user,
    externalId: `sec-${suffix}`,
    employeeId: ids.activeEmp,
    fullName: 'Karyawan Aktif',
    roles: ['SEC_OFFICER'],
    permissions: ['snapshot:upload', 'application:read'],
    scopes: {},
    delegatedFrom: [],
  }
})

afterAll(async () => {
  await prisma.sodException.deleteMany({ where: { violation: { ruleId: ids.sodRule } } })
  await prisma.sodViolation.deleteMany({ where: { ruleId: ids.sodRule } })
  await prisma.sodRule.deleteMany({ where: { id: ids.sodRule } })
  await prisma.accessAnomaly.deleteMany({ where: { applicationId: { in: [ids.appA, ids.appB] } } })
  for (const id of createdSnapshots) {
    await prisma.$executeRaw`DELETE FROM public.snapshot_line WHERE snapshot_id = ${id}::uuid`
  }
  await prisma.accessSnapshot.deleteMany({ where: { applicationId: { in: [ids.appA, ids.appB] } } })
  await prisma.entitlementCatalog.deleteMany({ where: { applicationId: { in: [ids.appA, ids.appB] } } })
  await prisma.application.deleteMany({ where: { id: { in: [ids.appA, ids.appB] } } })
  try {
    await prisma.appUser.deleteMany({ where: { id: ids.user } })
    await prisma.employee.deleteMany({ where: { id: { in: [ids.activeEmp, ids.termEmp, ids.crossEmp] } } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the audit trail; stays, correctly (K-7).
  }
  await staging.onModuleDestroy()
  await prisma.$disconnect()
})

describe('FR-B-007 · AN-01 terminated but active, persisted', () => {
  it('TC-IN-B-100 · an active account under a terminated employee becomes an open AN-01', async () => {
    const emp = `ET-${suffix}`
    await ingest(
      ids.appA,
      `account_id,account_name,entitlement_code,account_status,employee_number\n` +
        `u-term,term.acc,ORDER_${suffix},AKTIF,${emp}`,
    )

    const list = await anomalyService.list(principal, { take: 100 })
    const an01 = list.find((a) => a.type === 'AN_01')
    expect(an01).toBeDefined()
    expect(an01!.severity).toBe('KRITIS')
    expect(an01!.employee?.employee_number).toBe(emp)
  })
})

describe('FR-B-007 · AN-02 ownerless, carried forward not duplicated', () => {
  it('TC-IN-B-110 · an ownerless account is one open AN-02', async () => {
    await ingest(
      ids.appB,
      `account_id,account_name,entitlement_code,account_status\n` + `u-ghost,ghost.acc,APPROVE_${suffix},AKTIF`,
    )
    const list = await anomalyService.list(principal, { type: 'AN_02', applicationId: ids.appB, take: 100 })
    expect(list).toHaveLength(1)
    expect(list[0]!.account_id).toBe('u-ghost')
  })

  it('TC-IN-B-111 · re-uploading the same ownerless account carries the finding forward', async () => {
    const before = await anomalyService.list(principal, {
      type: 'AN_02',
      applicationId: ids.appB,
      take: 100,
    })
    const firstDetectedBefore = before[0]!.first_detected_at

    await ingest(
      ids.appB,
      `account_id,account_name,entitlement_code,account_status\n` + `u-ghost,ghost.acc,APPROVE_${suffix},AKTIF`,
    )

    const after = await anomalyService.list(principal, {
      type: 'AN_02',
      applicationId: ids.appB,
      take: 100,
    })
    // Still exactly one, and first_detected_at is unchanged: age is measured
    // from first sight (aturan 3), not from the latest snapshot.
    expect(after).toHaveLength(1)
    expect(after[0]!.first_detected_at).toBe(firstDetectedBefore)
  })
})

describe('FR-B-024 · cross-application SoD', () => {
  it('TC-IN-B-120 · holding group A in app A and group B in app B raises a violation', async () => {
    const emp = `EC-${suffix}`
    // Group A in application A.
    await ingest(
      ids.appA,
      `account_id,account_name,entitlement_code,account_status,employee_number\n` +
        `u-cross,cross.acc,ORDER_${suffix},AKTIF,${emp}`,
    )
    // Group B in application B — completes the toxic pair across applications.
    await ingest(
      ids.appB,
      `account_id,account_name,entitlement_code,account_status,employee_number\n` +
        `u-cross,cross.acc,APPROVE_${suffix},AKTIF,${emp}`,
    )

    const violations = await sodService.listViolations(principal, { take: 100 })
    const mine = violations.filter((v) => v.rule.code === `SOD-UJI-${suffix}`)
    expect(mine).toHaveLength(1)
    expect(mine[0]!.entitlement_a.application).toBe(`UJA-${suffix}`)
    expect(mine[0]!.entitlement_b.application).toBe(`UJB-${suffix}`)
    expect(mine[0]!.employee.employee_number).toBe(emp)
  })

  it('TC-IN-B-121 · simulate matches detection on the same data', async () => {
    const result = await sodService.simulate(principal, {
      groupA: { entitlement_ids: [ids.entOrder] },
      groupB: { entitlement_ids: [ids.entApprove] },
    })
    // The same cross-application holder detection found.
    expect(result.would_violate_count).toBeGreaterThanOrEqual(1)
    expect(result.affected_employees.length).toBe(result.would_violate_count)
  })

  it('TC-IN-B-122 · an exception moves the violation out of TERBUKA', async () => {
    const open = await sodService.listViolations(principal, { status: 'TERBUKA', take: 100 })
    const target = open.find((v) => v.rule.code === `SOD-UJI-${suffix}`)
    expect(target).toBeDefined()

    const reviewDate = new Date()
    reviewDate.setMonth(reviewDate.getMonth() + 6)
    await asUser(() =>
      sodService.grantException(principal, target!.id, {
        businessReason: 'Peran rangkap sementara selama transisi tim.',
        compensatingControl: 'Rekonsiliasi harian oleh akuntansi.',
        approvedBy: ids.user,
        reviewDate: reviewDate.toISOString().slice(0, 10),
      }),
    )

    const stillOpen = await sodService.listViolations(principal, { status: 'TERBUKA', take: 100 })
    expect(stillOpen.find((v) => v.id === target!.id)).toBeUndefined()
  })
})
