import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { ControlService } from '../src/modules/evidence/control.service.js'
import { FrameworkService } from '../src/modules/evidence/framework.service.js'

/**
 * Modul A foundation (FR-A-001, FR-A-002, FR-A-003), against the real database.
 *
 * Covers what matters and what a pure test cannot: that a control edit produces
 * a new version while the old one survives (FR-A-001 aturan 2), that mapping is
 * refused against a heading clause, and that the coverage view counts only leaf
 * clauses and surfaces an uncovered one as a gap (FR-A-003 aturan 4). Every
 * write here goes through UnitOfWork, so the audit chain is exercised too.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const controls = new ControlService(prisma, uow)
const frameworks = new FrameworkService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  owner: randomUUID(),
  user: randomUUID(),
  framework: randomUUID(),
}
const suffix = ids.framework.slice(0, 8)

let principal: Principal
const createdControlIds: string[] = []

async function asUser<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(
    {
      requestId: randomUUID(),
      actorId: ids.user,
      actorRoles: ['AUDITOR_INT'],
      sessionId: null,
      ipAddress: '127.0.0.1',
    },
    fn,
  )
}

beforeAll(async () => {
  await prisma.$connect()
  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OUA-${suffix}`, name: 'Unit Uji Modul A' },
  })
  await prisma.employee.create({
    data: {
      id: ids.owner,
      employeeNumber: `EMA-${suffix}`,
      fullName: 'Pemilik Kontrol Uji',
      email: `owner-a-${suffix}@contoh.internal`,
      jobTitle: 'Manajer',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2022-01-01'),
    },
  })
  await prisma.appUser.create({
    data: { id: ids.user, employeeId: ids.owner, externalId: `auditor-${suffix}`, userType: 'INTERNAL' },
  })

  principal = {
    userId: ids.user,
    externalId: `auditor-${suffix}`,
    employeeId: ids.owner,
    fullName: 'Pemilik Kontrol Uji',
    roles: ['AUDITOR_INT'],
    permissions: ['control:read', 'control:write'],
    scopes: {},
    delegatedFrom: [],
  }
})

afterAll(async () => {
  await prisma.controlMapping.deleteMany({ where: { control: { id: { in: createdControlIds } } } })
  await prisma.controlVersion.deleteMany({ where: { controlId: { in: createdControlIds } } })
  await prisma.control.deleteMany({ where: { id: { in: createdControlIds } } })
  await prisma.frameworkItem.deleteMany({ where: { frameworkId: ids.framework } })
  await prisma.framework.deleteMany({ where: { id: ids.framework } })
  try {
    await prisma.appUser.deleteMany({ where: { id: ids.user } })
    await prisma.employee.deleteMany({ where: { id: ids.owner } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the audit trail; stays, correctly (K-7).
  }
  await prisma.$disconnect()
})

describe('FR-A-001 · control versioning', () => {
  it('TC-IN-A-001 · creating a control writes version 1', async () => {
    const { id } = await asUser(() =>
      controls.create(principal, {
        code: `CTL-${suffix}-1`,
        title: 'Kontrol uji satu',
        objective: 'Tujuan pengendalian uji yang cukup panjang.',
        ownerEmployeeId: ids.owner,
        frequency: 'BULANAN',
        controlType: 'PREVENTIF',
        nature: 'MANUAL',
        riskLevel: 'SEDANG',
        expectedEvidenceTypes: ['LAPORAN_SISTEM'],
      }),
    )
    createdControlIds.push(id)

    const versions = await controls.listVersions(principal, id)
    expect(versions).toHaveLength(1)
    expect(versions[0]!.version_no).toBe(1)
    expect(versions[0]!.title).toBe('Kontrol uji satu')
  })

  it('TC-IN-A-002 · editing a control produces a new version and preserves the old', async () => {
    const { id } = await asUser(() =>
      controls.create(principal, {
        code: `CTL-${suffix}-2`,
        title: 'Judul awal',
        objective: 'Tujuan awal yang memadai.',
        ownerEmployeeId: ids.owner,
        frequency: 'BULANAN',
        controlType: 'DETEKTIF',
        nature: 'OTOMATIS',
        riskLevel: 'SEDANG',
        expectedEvidenceTypes: [],
      }),
    )
    createdControlIds.push(id)

    await asUser(() => controls.update(principal, id, { title: 'Judul baru', riskLevel: 'KRITIS' }))

    const versions = await controls.listVersions(principal, id)
    expect(versions).toHaveLength(2)
    // Newest first.
    expect(versions[0]!.version_no).toBe(2)
    expect(versions[0]!.title).toBe('Judul baru')
    expect(versions[0]!.risk_level).toBe('KRITIS')
    // The old version survives unchanged (FR-A-001 aturan 2).
    expect(versions[1]!.version_no).toBe(1)
    expect(versions[1]!.title).toBe('Judul awal')
    expect(versions[1]!.risk_level).toBe('SEDANG')

    const current = await controls.findOne(principal, id)
    expect(current.current_version).toBe(2)
  })

  it('TC-IN-A-003 · a retired control cannot be edited', async () => {
    const { id } = await asUser(() =>
      controls.create(principal, {
        code: `CTL-${suffix}-3`,
        title: 'Kontrol untuk dinonaktifkan',
        objective: 'Tujuan pengendalian uji.',
        ownerEmployeeId: ids.owner,
        frequency: 'TAHUNAN',
        controlType: 'KOREKTIF',
        nature: 'MANUAL',
        riskLevel: 'RENDAH',
        expectedEvidenceTypes: [],
      }),
    )
    createdControlIds.push(id)

    await asUser(() => controls.setActive(principal, id, false))
    await expect(asUser(() => controls.update(principal, id, { title: 'x' }))).rejects.toThrow(
      /dinonaktifkan/i,
    )
  })
})

describe('FR-A-002 / FR-A-003 · framework coverage', () => {
  it('TC-IN-A-010 · coverage counts only leaves and surfaces an uncovered clause', async () => {
    await prisma.framework.create({
      data: { id: ids.framework, code: `FW-${suffix}`, name: 'Framework Uji' },
    })
    // Two headings, three leaves. Import through the service so parent wiring is
    // exercised too.
    await asUser(() =>
      frameworks.importItems(principal, ids.framework, [
        { ref: 'H1', title: 'Bagian Satu' },
        { ref: 'H1.1', title: 'Klausa satu-satu', parentRef: 'H1' },
        { ref: 'H1.2', title: 'Klausa satu-dua', parentRef: 'H1' },
        { ref: 'H2', title: 'Bagian Dua' },
        { ref: 'H2.1', title: 'Klausa dua-satu', parentRef: 'H2' },
      ]),
    )

    // A control mapped PENUH to H1.1 only. H1.2 and H2.1 stay uncovered.
    const { id: controlId } = await asUser(() =>
      controls.create(principal, {
        code: `CTL-${suffix}-cov`,
        title: 'Kontrol cakupan',
        objective: 'Tujuan pengendalian uji cakupan.',
        ownerEmployeeId: ids.owner,
        frequency: 'BULANAN',
        controlType: 'PREVENTIF',
        nature: 'MANUAL',
        riskLevel: 'SEDANG',
        expectedEvidenceTypes: [],
      }),
    )
    createdControlIds.push(controlId)

    const items = await frameworks.listItems(principal, ids.framework)
    const h11 = items.find((i) => i.ref === 'H1.1')!
    expect(h11.is_leaf).toBe(true)
    await asUser(() =>
      frameworks.createMapping(principal, controlId, {
        frameworkItemId: h11.id,
        coverageLevel: 'PENUH',
      }),
    )

    const coverage = await frameworks.coverage(principal, ids.framework)
    // Three leaves, one covered.
    expect(coverage.summary.total_items).toBe(3)
    expect(coverage.summary.fully_covered).toBe(1)
    expect(coverage.summary.not_covered).toBe(2)
    const gap = coverage.items.filter((i) => i.coverage_status === 'TIDAK_TERTUTUP').map((i) => i.ref)
    expect(gap.sort()).toEqual(['H1.2', 'H2.1'])
  })

  it('TC-IN-A-011 · mapping to a heading clause is refused', async () => {
    const items = await frameworks.listItems(principal, ids.framework)
    const heading = items.find((i) => i.ref === 'H1')!
    expect(heading.is_leaf).toBe(false)
    const controlId = createdControlIds.find((_, idx) => idx >= 0)!
    await expect(
      asUser(() =>
        frameworks.createMapping(principal, controlId, {
          frameworkItemId: heading.id,
          coverageLevel: 'PENUH',
        }),
      ),
    ).rejects.toThrow(/leaf|judul bab/i)
  })
})
