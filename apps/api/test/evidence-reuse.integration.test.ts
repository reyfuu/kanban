import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { EvidenceService } from '../src/modules/evidence/evidence-item.service.js'

/**
 * FR-A-012 · evidence reuse, against the real database.
 *
 * evidence-reuse.test.ts already pins the rules as arithmetic. What that cannot
 * show is the part that actually protects the audit file: that a mismatched
 * period is refused at the point of WRITING the link, that an AUDITOR_INT's
 * override is accepted and preserved with its reason, and that someone without
 * that role cannot grant themselves the same exemption. Those three depend on
 * the principal, the transaction and the audit trail, so they are tested here.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const evidenceSvc = new EvidenceService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  employee: randomUUID(),
  picEmployee: randomUUID(),
  auditor: randomUUID(),
  pic: randomUUID(),
  engagement: randomUUID(),
  requestItem: randomUUID(),
  covering: randomUUID(),
  mismatched: randomUUID(),
}
const suffix = ids.engagement.slice(0, 8)

const createdLinkIds: string[] = []

let auditor: Principal
let pic: Principal

function asRole(userId: string, roles: string[]) {
  return <T>(fn: () => Promise<T>): Promise<T> =>
    runWithRequestContext(
      {
        requestId: randomUUID(),
        actorId: userId,
        actorRoles: roles,
        sessionId: null,
        ipAddress: '127.0.0.1',
      },
      fn,
    )
}

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OU12-${suffix}`, name: 'Unit Uji FR-A-012' },
  })
  await prisma.employee.create({
    data: {
      id: ids.employee,
      employeeNumber: `EM12-${suffix}`,
      fullName: 'Pegawai Uji Reuse',
      email: `reuse-${suffix}@contoh.internal`,
      jobTitle: 'Manajer',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2022-01-01'),
    },
  })
  // A second employee: app_user is unique per employee, and the test needs two
  // distinct principals to show that the override is role-gated.
  await prisma.employee.create({
    data: {
      id: ids.picEmployee,
      employeeNumber: `PIC12-${suffix}`,
      fullName: 'PIC Uji Reuse',
      email: `pic-emp-${suffix}@contoh.internal`,
      jobTitle: 'Staf',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2022-01-01'),
    },
  })
  await prisma.appUser.createMany({
    data: [
      { id: ids.auditor, employeeId: ids.employee, externalId: `aud-${suffix}`, userType: 'INTERNAL' },
      { id: ids.pic, employeeId: ids.picEmployee, externalId: `pic-${suffix}`, userType: 'INTERNAL' },
    ],
  })

  await prisma.engagement.create({
    data: {
      id: ids.engagement,
      code: `ENG12-${suffix}`,
      title: 'Penugasan uji reuse bukti',
      engagementType: 'AUDIT_INTERNAL',
      periodFrom: new Date('2026-04-01'),
      periodTo: new Date('2026-06-30'),
      leadAuditorId: ids.auditor,
      status: 'PERENCANAAN',
    },
  })

  // The request asks about Q2 2026. That window is the whole point of the test.
  await prisma.requestItem.create({
    data: {
      id: ids.requestItem,
      engagementId: ids.engagement,
      sequenceNo: 1,
      description: 'Daftar hak akses aplikasi inti untuk kuartal dua.',
      evidencePeriodFrom: new Date('2026-04-01'),
      evidencePeriodTo: new Date('2026-06-30'),
      responsibleOrgUnitId: ids.orgUnit,
      picEmployeeId: ids.employee,
      dueDate: new Date('2026-07-15'),
      status: 'DRAF',
    },
  })

  await prisma.evidence.createMany({
    data: [
      {
        id: ids.covering,
        title: 'Daftar akses setahun penuh',
        evidenceType: 'LAPORAN_SISTEM',
        validityFrom: new Date('2026-01-01'),
        validityTo: new Date('2026-12-31'),
        ownerOrgUnitId: ids.orgUnit,
        classification: 'INTERNAL',
        source: 'UNGGAHAN_MANUAL',
        status: 'DITERIMA',
        createdBy: ids.auditor,
      },
      {
        // Starts a month into the audited quarter: it cannot show who had
        // access during April.
        id: ids.mismatched,
        title: 'Daftar akses mulai Mei',
        evidenceType: 'LAPORAN_SISTEM',
        validityFrom: new Date('2026-05-01'),
        validityTo: new Date('2026-12-31'),
        ownerOrgUnitId: ids.orgUnit,
        classification: 'INTERNAL',
        source: 'UNGGAHAN_MANUAL',
        status: 'DITERIMA',
        createdBy: ids.auditor,
      },
    ],
  })

  const base = {
    employeeId: ids.employee,
    fullName: 'Pegawai Uji Reuse',
    jobTitle: null,
    scopes: {},
    delegatedFrom: [],
    permissions: ['control:read', 'control:write'],
  }
  auditor = { ...base, userId: ids.auditor, externalId: `aud-${suffix}`, roles: ['AUDITOR_INT'] }
  pic = {
    ...base,
    employeeId: ids.picEmployee,
    userId: ids.pic,
    externalId: `pic-${suffix}`,
    roles: ['EMPLOYEE'],
  }
})

afterAll(async () => {
  await prisma.evidenceLink.deleteMany({ where: { id: { in: createdLinkIds } } })
  await prisma.evidence.deleteMany({ where: { id: { in: [ids.covering, ids.mismatched] } } })
  await prisma.requestItem.deleteMany({ where: { id: ids.requestItem } })
  await prisma.engagement.deleteMany({ where: { id: ids.engagement } })
  try {
    await prisma.appUser.deleteMany({ where: { id: { in: [ids.auditor, ids.pic] } } })
    await prisma.employee.deleteMany({ where: { id: { in: [ids.employee, ids.picEmployee] } } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the audit trail; stays, correctly (K-7).
  }
  await prisma.$disconnect()
})

describe('FR-A-012 aturan 2 · penautan di luar periode', () => {
  it('menerima bukti yang mencakup periode yang diminta', async () => {
    const { id } = await asRole(ids.auditor, ['AUDITOR_INT'])(() =>
      evidenceSvc.createLink(auditor, ids.covering, {
        targetType: 'REQUEST_ITEM',
        targetId: ids.requestItem,
      }),
    )
    createdLinkIds.push(id)
    expect(id).toBeTruthy()
  })

  it('MENOLAK bukti di luar periode bila tanpa alasan', async () => {
    await expect(
      asRole(ids.auditor, ['AUDITOR_INT'])(() =>
        evidenceSvc.createLink(auditor, ids.mismatched, {
          targetType: 'REQUEST_ITEM',
          targetId: ids.requestItem,
        }),
      ),
    ).rejects.toThrow(/2026-05-01/)

    // Penolakan harus benar-benar tidak menulis apa pun. Kalau tautannya
    // sempat tersimpan lalu galat dilempar, berkas auditnya tetap tercemar.
    const leaked = await prisma.evidenceLink.count({
      where: { evidenceId: ids.mismatched, targetId: ids.requestItem },
    })
    expect(leaked).toBe(0)
  })

  it('MENOLAK pengesampingan oleh peran selain AUDITOR_INT', async () => {
    // Kalau PIC bisa menyetujui ketidakcocokannya sendiri, aturan 2 hanya
    // menjadi formalitas: pihak yang paling terdorong melewatinya justru
    // memegang kuncinya.
    await expect(
      asRole(ids.pic, ['EMPLOYEE'])(() =>
        evidenceSvc.createLink(pic, ids.mismatched, {
          targetType: 'REQUEST_ITEM',
          targetId: ids.requestItem,
          periodOverrideReason: 'Bukti bulan April tidak tersedia dari sistem sumber.',
        }),
      ),
    ).rejects.toThrow(/AUDITOR_INT/)
  })

  it('menerima pengesampingan AUDITOR_INT dan menyimpan alasannya di jejak audit', async () => {
    const reason = 'Bukti April tidak tersedia; dilengkapi konfirmasi tertulis pemilik aplikasi.'
    const { id } = await asRole(ids.auditor, ['AUDITOR_INT'])(() =>
      evidenceSvc.createLink(auditor, ids.mismatched, {
        targetType: 'REQUEST_ITEM',
        targetId: ids.requestItem,
        periodOverrideReason: reason,
      }),
    )
    createdLinkIds.push(id)

    // Alasannya harus bisa ditemukan kembali. Pengesampingan yang diizinkan
    // tapi tidak terekam sama saja dengan tidak ada aturannya.
    const entry = await prisma.auditLog.findFirst({
      where: { objectType: 'EVIDENCE', objectId: ids.mismatched, action: 'TAUTKAN_BUKTI' },
      orderBy: { occurredAt: 'desc' },
    })
    expect(entry).not.toBeNull()
    expect(JSON.stringify(entry?.afterValue)).toContain(reason)
  })
})

describe('FR-A-012 aturan 1 & 3 · saran bukti', () => {
  it('menyarankan bukti yang relevan dan menandai cakupan periodenya', async () => {
    const out = await asRole(ids.auditor, ['AUDITOR_INT'])(() =>
      evidenceSvc.suggestForRequest(auditor, ids.requestItem),
    )

    const covering = out.find((s) => s.id === ids.covering)
    const mismatched = out.find((s) => s.id === ids.mismatched)

    expect(covering, 'bukti yang mencakup periode harus disarankan').toBeDefined()
    expect(covering?.coversPeriod).toBe(true)

    // Yang tidak mencakup tetap muncul, tetapi ditandai: auditor berhak
    // melihatnya dan memutuskan sendiri, bukan disembunyikan darinya.
    expect(mismatched?.coversPeriod).toBe(false)

    // Aturan 1: yang paling relevan lebih dulu.
    expect(out[0]?.coversPeriod).toBe(true)
  })

  it('aturan 3 · bukti kedaluwarsa tidak muncul pada saran', async () => {
    const expiredId = randomUUID()
    await prisma.evidence.create({
      data: {
        id: expiredId,
        title: 'Daftar akses tahun lalu',
        evidenceType: 'LAPORAN_SISTEM',
        validityFrom: new Date('2025-01-01'),
        validityTo: new Date('2025-12-31'),
        ownerOrgUnitId: ids.orgUnit,
        classification: 'INTERNAL',
        source: 'UNGGAHAN_MANUAL',
        status: 'DITERIMA',
        createdBy: ids.auditor,
      },
    })

    try {
      const out = await asRole(ids.auditor, ['AUDITOR_INT'])(() =>
        evidenceSvc.suggestForRequest(auditor, ids.requestItem),
      )
      expect(out.map((s) => s.id)).not.toContain(expiredId)
    } finally {
      await prisma.evidence.deleteMany({ where: { id: expiredId } })
    }
  })
})
