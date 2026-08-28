import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { NotificationService } from '../src/modules/shared/notification/notification.service.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import { EscalationService } from '../src/modules/evidence/escalation.service.js'

/**
 * FR-A-008 · escalation end to end.
 *
 * escalation-rules.test.ts pins the schedule. This proves the part the schedule
 * cannot: that the right PEOPLE actually receive rows. The ladder is only a
 * control if the manager genuinely appears on day 0 and the audit lead on day 3
 * -- a correct ladder wired to the wrong recipients fails silently, because the
 * job still reports that it sent something.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const notifications = new NotificationService(prisma)
const escalation = new EscalationService(prisma, uow, notifications)

const ids = {
  orgUnit: randomUUID(),
  managerEmp: randomUUID(),
  picEmp: randomUUID(),
  leadEmp: randomUUID(),
  managerUser: randomUUID(),
  picUser: randomUUID(),
  leadUser: randomUUID(),
  engagement: randomUUID(),
  item: randomUUID(),
}
const suffix = ids.engagement.slice(0, 8)
const DUE = new Date('2026-06-10T00:00:00.000Z')
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

async function asSystem<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(
    {
      requestId: randomUUID(),
      actorId: ids.leadUser,
      actorRoles: ['AUDIT_LEAD'],
      sessionId: null,
      ipAddress: '127.0.0.1',
    },
    fn,
  )
}

/** Notifications for this test's request item only. */
async function rowsForItem() {
  return prisma.notification.findMany({
    where: { objectType: 'REQUEST_ITEM', objectId: ids.item },
    select: { recipientUserId: true, code: true, canBeSummarized: true },
  })
}

beforeAll(async () => {
  await prisma.$connect()
  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OUE-${suffix}`, name: 'Unit Uji Eskalasi' },
  })

  await prisma.employee.create({
    data: {
      id: ids.managerEmp,
      employeeNumber: `MGR-${suffix}`,
      fullName: 'Atasan Langsung',
      email: `mgr-${suffix}@contoh.internal`,
      jobTitle: 'Kepala Unit',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2020-01-01'),
    },
  })
  await prisma.employee.createMany({
    data: [
      {
        id: ids.picEmp,
        employeeNumber: `PIC-${suffix}`,
        fullName: 'PIC Bukti',
        email: `pic-${suffix}@contoh.internal`,
        jobTitle: 'Staf',
        orgUnitId: ids.orgUnit,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2022-01-01'),
        managerId: ids.managerEmp,
      },
      {
        id: ids.leadEmp,
        employeeNumber: `LEA-${suffix}`,
        fullName: 'Ketua Tim Audit',
        email: `lead-${suffix}@contoh.internal`,
        jobTitle: 'Kepala SKAI',
        orgUnitId: ids.orgUnit,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2019-01-01'),
      },
    ],
  })

  await prisma.appUser.createMany({
    data: [
      { id: ids.managerUser, employeeId: ids.managerEmp, externalId: `mgr-${suffix}`, userType: 'INTERNAL' },
      { id: ids.picUser, employeeId: ids.picEmp, externalId: `pic-${suffix}`, userType: 'INTERNAL' },
      { id: ids.leadUser, employeeId: ids.leadEmp, externalId: `lead-${suffix}`, userType: 'INTERNAL' },
    ],
  })

  await prisma.engagement.create({
    data: {
      id: ids.engagement,
      code: `ESC-${suffix}`,
      title: 'Penugasan uji eskalasi',
      engagementType: 'AUDIT_INTERNAL',
      periodFrom: new Date('2026-01-01'),
      periodTo: new Date('2026-12-31'),
      leadAuditorId: ids.leadUser,
      status: 'BERJALAN',
    },
  })

  await prisma.requestItem.create({
    data: {
      id: ids.item,
      engagementId: ids.engagement,
      sequenceNo: 1,
      description: 'Bukti pengendalian akses aplikasi inti.',
      picEmployeeId: ids.picEmp,
      dueDate: DUE,
      status: 'TERBIT',
    },
  })
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { objectId: ids.item } })
  await prisma.requestItem.deleteMany({ where: { id: ids.item } })
  await prisma.engagement.deleteMany({ where: { id: ids.engagement } })
  try {
    await prisma.appUser.deleteMany({
      where: { id: { in: [ids.managerUser, ids.picUser, ids.leadUser] } },
    })
    await prisma.employee.deleteMany({ where: { id: { in: [ids.picEmp, ids.leadEmp] } } })
    await prisma.employee.deleteMany({ where: { id: ids.managerEmp } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the audit trail; stays, correctly (K-7).
  }
  await prisma.$disconnect()
})

describe('FR-A-008 · siapa yang benar-benar diberi tahu', () => {
  it('H-3 hanya PIC', async () => {
    await asSystem(() => escalation.runDailyChase(day('2026-06-07')))
    const rows = await rowsForItem()
    expect(rows.map((r) => r.recipientUserId)).toEqual([ids.picUser])
    expect(rows[0]?.code).toBe('NT-02')
  })

  it('hari tenggat menambahkan atasan, TANPA mengeluarkan PIC', async () => {
    await prisma.notification.deleteMany({ where: { objectId: ids.item } })
    await asSystem(() => escalation.runDailyChase(day('2026-06-10')))

    const to = (await rowsForItem()).map((r) => r.recipientUserId).sort()
    expect(to).toEqual([ids.managerUser, ids.picUser].sort())
  })

  it('hari ketiga menambahkan ketua tim audit', async () => {
    await prisma.notification.deleteMany({ where: { objectId: ids.item } })
    await asSystem(() => escalation.runDailyChase(day('2026-06-13')))

    const to = (await rowsForItem()).map((r) => r.recipientUserId).sort()
    expect(to).toEqual([ids.leadUser, ids.managerUser, ids.picUser].sort())
  })

  it('eskalasi terlambat memakai NT-03 dan TIDAK dapat diringkas', async () => {
    await prisma.notification.deleteMany({ where: { objectId: ids.item } })
    await asSystem(() => escalation.runDailyChase(day('2026-06-10')))

    const rows = await rowsForItem()
    expect(rows.length).toBeGreaterThan(0)
    for (const r of rows) {
      expect(r.code).toBe('NT-03')
      expect(r.canBeSummarized).toBe(false)
    }
  })

  it('hari tanpa tahap tidak mengirim apa pun', async () => {
    await prisma.notification.deleteMany({ where: { objectId: ids.item } })
    await asSystem(() => escalation.runDailyChase(day('2026-06-14')))
    expect(await rowsForItem()).toHaveLength(0)
  })

  it('permintaan yang sudah SELESAI tidak dikejar', async () => {
    // Permintaan yang sudah dipenuhi tidak terlambat, apa pun tanggal
    // tenggatnya — mengeskalasinya ke atasan PIC adalah tuduhan yang salah.
    await prisma.notification.deleteMany({ where: { objectId: ids.item } })
    await prisma.requestItem.update({ where: { id: ids.item }, data: { status: 'SELESAI' } })
    try {
      await asSystem(() => escalation.runDailyChase(day('2026-06-10')))
      expect(await rowsForItem()).toHaveLength(0)
    } finally {
      await prisma.requestItem.update({ where: { id: ids.item }, data: { status: 'TERBIT' } })
    }
  })

  it('eskalasi tercatat di jejak audit', async () => {
    // FR-A-008 adalah kontrol, dan kontrol yang tidak meninggalkan jejak tidak
    // dapat dibuktikan pernah berjalan — persis pertanyaan auditornya.
    await asSystem(() => escalation.runDailyChase(day('2026-06-13')))
    const entry = await prisma.auditLog.findFirst({
      where: { objectType: 'REQUEST_ITEM', objectId: ids.item, action: 'ESKALASI_PERMINTAAN_BUKTI' },
      orderBy: { occurredAt: 'desc' },
    })
    expect(entry).not.toBeNull()
  })
})

describe('FR-A-008 · daftar kritis', () => {
  it('muncul setelah tujuh hari, dan tidak sebelum itu', async () => {
    expect((await escalation.criticalItems(day('2026-06-16'))).map((r) => r.id)).not.toContain(
      ids.item,
    )
    expect((await escalation.criticalItems(day('2026-06-17'))).map((r) => r.id)).toContain(ids.item)
  })
})
