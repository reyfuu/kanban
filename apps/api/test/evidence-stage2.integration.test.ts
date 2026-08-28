import { randomUUID, createHash } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { EngagementService } from '../src/modules/evidence/engagement.service.js'
import { RequestItemService } from '../src/modules/evidence/request-item.service.js'
import { EvidenceService } from '../src/modules/evidence/evidence-item.service.js'
import { FindingService } from '../src/modules/evidence/finding.service.js'

/**
 * Modul A stage 2 (FR-A-004..017), against the real database.
 *
 * Covers the acceptance behaviour that a pure test cannot: the engagement
 * lifecycle refuses -> PELAPORAN while a request is open (FR-A-005 rule 1), the
 * request-item review flow enforces the 20-char rejection reason (FR-A-007
 * rule 2), evidence integrity refuses a duplicate SHA-256 and never overwrites
 * a version (FR-A-011 / K-8), and the finding lifecycle requires supporting
 * evidence, restricts closing to AUDIT_LEAD, and derives the SLA due date from
 * risk (FR-A-016/017). Every write exercises the audit chain.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const engagements = new EngagementService(prisma, uow)
const requestItems = new RequestItemService(prisma, uow)
const evidence = new EvidenceService(prisma, uow)
const findings = new FindingService(prisma, uow)

const suffix = randomUUID().slice(0, 8)
const ids = {
  orgUnit: randomUUID(),
  auditorEmp: randomUUID(),
  auditor: randomUUID(),
  leadEmp: randomUUID(),
  lead: randomUUID(),
  picEmp: randomUUID(),
  control: randomUUID(),
}

let auditor: Principal
let lead: Principal
const createdEngagementIds: string[] = []
const createdEvidenceIds: string[] = []

function ctx(userId: string, roles: string[]) {
  return {
    requestId: randomUUID(),
    actorId: userId,
    actorRoles: roles,
    sessionId: null,
    ipAddress: '127.0.0.1',
  }
}
async function asAuditor<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(ctx(ids.auditor, ['AUDITOR_INT']), fn)
}
async function asLead<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(ctx(ids.lead, ['AUDIT_LEAD']), fn)
}

beforeAll(async () => {
  await prisma.$connect()
  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OUA2-${suffix}`, name: 'Unit Uji A2' },
  })
  await prisma.employee.createMany({
    data: [
      { id: ids.auditorEmp, employeeNumber: `AUE-${suffix}`, fullName: 'Auditor Uji', email: `aue-${suffix}@x.internal`, jobTitle: 'Auditor', orgUnitId: ids.orgUnit, employmentStatus: 'AKTIF', joinedAt: new Date('2022-01-01') },
      { id: ids.leadEmp, employeeNumber: `LDE-${suffix}`, fullName: 'Lead Uji', email: `lde-${suffix}@x.internal`, jobTitle: 'Kepala SKAI', orgUnitId: ids.orgUnit, employmentStatus: 'AKTIF', joinedAt: new Date('2022-01-01') },
      { id: ids.picEmp, employeeNumber: `PICE-${suffix}`, fullName: 'PIC Uji', email: `pice-${suffix}@x.internal`, jobTitle: 'Staf', orgUnitId: ids.orgUnit, employmentStatus: 'AKTIF', joinedAt: new Date('2022-01-01') },
    ],
  })
  await prisma.appUser.createMany({
    data: [
      { id: ids.auditor, employeeId: ids.auditorEmp, externalId: `auditor-${suffix}`, userType: 'INTERNAL' },
      { id: ids.lead, employeeId: ids.leadEmp, externalId: `lead-${suffix}`, userType: 'INTERNAL' },
    ],
  })
  await prisma.control.create({
    data: {
      id: ids.control,
      code: `CTLA2-${suffix}`,
      title: 'Kontrol uji A2',
      objective: 'Tujuan pengendalian uji A2.',
      ownerEmployeeId: ids.auditorEmp,
      frequency: 'BULANAN',
      controlType: 'DETEKTIF',
      nature: 'MANUAL',
      riskLevel: 'SEDANG',
    },
  })

  auditor = {
    userId: ids.auditor,
    externalId: `auditor-${suffix}`,
    employeeId: ids.auditorEmp,
    fullName: 'Auditor Uji',
    roles: ['AUDITOR_INT'],
    permissions: ['control:read', 'control:write'],
    scopes: {},
    delegatedFrom: [],
  }
  lead = {
    userId: ids.lead,
    externalId: `lead-${suffix}`,
    employeeId: ids.leadEmp,
    fullName: 'Lead Uji',
    roles: ['AUDIT_LEAD'],
    permissions: ['control:read', 'control:write'],
    scopes: {},
    delegatedFrom: [],
  }
})

afterAll(async () => {
  await prisma.evidenceLink.deleteMany({ where: { evidenceId: { in: createdEvidenceIds } } })
  await prisma.evidenceVersion.deleteMany({ where: { evidenceId: { in: createdEvidenceIds } } })
  for (const eid of createdEngagementIds) {
    await prisma.evidenceLink.deleteMany({ where: { targetType: 'FINDING', targetId: { in: (await prisma.finding.findMany({ where: { engagementId: eid }, select: { id: true } })).map((f) => f.id) } } })
    await prisma.remediation.deleteMany({ where: { finding: { engagementId: eid } } })
    await prisma.finding.deleteMany({ where: { engagementId: eid } })
    await prisma.requestItem.deleteMany({ where: { engagementId: eid } })
    await prisma.engagementControl.deleteMany({ where: { engagementId: eid } })
    await prisma.engagementMember.deleteMany({ where: { engagementId: eid } })
    await prisma.engagement.deleteMany({ where: { id: eid } })
  }
  await prisma.evidence.deleteMany({ where: { id: { in: createdEvidenceIds } } })
  await prisma.control.deleteMany({ where: { id: ids.control } })
  try {
    await prisma.appUser.deleteMany({ where: { id: { in: [ids.auditor, ids.lead] } } })
    await prisma.employee.deleteMany({ where: { id: { in: [ids.auditorEmp, ids.leadEmp, ids.picEmp] } } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by audit trail; stays (K-7).
  }
  await prisma.$disconnect()
})

async function newEngagement(): Promise<string> {
  const { id } = await asAuditor(() =>
    engagements.create(auditor, {
      title: 'Penugasan uji A2',
      engagementType: 'AUDIT_INTERNAL',
      periodFrom: new Date('2026-01-01'),
      periodTo: new Date('2026-06-30'),
      fieldworkEnd: new Date('2026-09-30'),
      leadAuditorId: ids.auditor,
      teamMemberIds: [],
      controlIds: [ids.control],
    }),
  )
  createdEngagementIds.push(id)
  return id
}

describe('FR-A-005 · engagement lifecycle', () => {
  it('TC-IN-A-020 · -> PELAPORAN is refused while a request item is open', async () => {
    const eid = await newEngagement()
    await asAuditor(() => engagements.transition(auditor, eid, 'BERJALAN', undefined))
    await asAuditor(() =>
      requestItems.create(auditor, eid, {
        description: 'Permintaan uji yang belum selesai.',
        picEmployeeId: ids.picEmp,
        dueDate: new Date('2026-09-05'),
        isMandatory: true,
      }),
    )
    await expect(
      asAuditor(() => engagements.transition(auditor, eid, 'PELAPORAN', undefined)),
    ).rejects.toThrow(/belum selesai/i)
  })

  it('TC-IN-A-021 · an illegal transition is refused', async () => {
    const eid = await newEngagement()
    // PERENCANAAN -> PELAPORAN is not in the table.
    await expect(
      asAuditor(() => engagements.transition(auditor, eid, 'PELAPORAN', undefined)),
    ).rejects.toThrow(/tidak dapat berpindah/i)
  })
})

describe('FR-A-007 · request item review', () => {
  it('TC-IN-A-030 · a rejection needs a 20-character reason', async () => {
    const eid = await newEngagement()
    await asAuditor(() => engagements.transition(auditor, eid, 'BERJALAN', undefined))
    const { id } = await asAuditor(() =>
      requestItems.create(auditor, eid, {
        description: 'Permintaan untuk ditelaah.',
        picEmployeeId: ids.picEmp,
        dueDate: new Date('2026-09-05'),
        isMandatory: true,
      }),
    )
    await asAuditor(() => requestItems.publish(auditor, eid))
    // Submit as the PIC, then the auditor reviews.
    const picPrincipal: Principal = { ...auditor, userId: ids.auditor, employeeId: ids.picEmp }
    await runWithRequestContext(ctx(ids.auditor, ['EMPLOYEE']), () =>
      requestItems.submit(picPrincipal, id),
    )
    await expect(
      asAuditor(() => requestItems.review(auditor, id, 'TOLAK', 'pendek')),
    ).rejects.toThrow(/20 karakter/i)

    // A proper acceptance completes it.
    await asAuditor(() => requestItems.review(auditor, id, 'TERIMA', undefined))
    const readiness = await asAuditor(() => engagements.readiness(auditor, eid))
    expect(readiness.readiness_percentage).toBe(100)
  })
})

describe('FR-A-011 · evidence integrity (K-8)', () => {
  async function newEvidence(): Promise<string> {
    const { id } = await asAuditor(() =>
      evidence.create(auditor, {
        title: 'Bukti uji K-8',
        evidenceType: 'LAPORAN_SISTEM',
        classification: 'TERBATAS',
        source: 'UNGGAHAN_MANUAL',
      }),
    )
    createdEvidenceIds.push(id)
    return id
  }
  function sha(text: string): string {
    return createHash('sha256').update(text).digest('hex')
  }

  it('TC-IN-A-040 · a duplicate SHA-256 is refused, and versions never overwrite', async () => {
    const id = await newEvidence()
    const s1 = sha(`v1-${id}`)
    await asAuditor(() =>
      evidence.addVersion(auditor, id, { storageKey: 'k1', fileName: 'a.csv', fileSize: 10, mimeType: 'text/csv', sha256: s1 }),
    )
    // Same content again -> refused (FR-A-011 rule 2).
    await expect(
      asAuditor(() =>
        evidence.addVersion(auditor, id, { storageKey: 'kdup', fileName: 'dup.csv', fileSize: 10, mimeType: 'text/csv', sha256: s1 }),
      ),
    ).rejects.toThrow(/identik/i)

    // A different content becomes version 2; version 1 is preserved and superseded.
    const s2 = sha(`v2-${id}`)
    const { versionNo } = await asAuditor(() =>
      evidence.addVersion(auditor, id, { storageKey: 'k2', fileName: 'b.csv', fileSize: 20, mimeType: 'text/csv', sha256: s2 }),
    )
    expect(versionNo).toBe(2)

    const attestation = await asAuditor(() => evidence.attestation(auditor, id))
    expect(attestation.versions).toHaveLength(2)
    const v1 = attestation.versions.find((v) => v.version_no === 1)!
    const v2 = attestation.versions.find((v) => v.version_no === 2)!
    expect(v1.superseded_at).not.toBeNull()
    expect(v2.superseded_at).toBeNull()
    expect(v1.sha256).toBe(s1)
  })

  it('TC-IN-A-041 · a download whose content hash mismatches is refused', async () => {
    const id = await newEvidence()
    const good = sha(`only-${id}`)
    await asAuditor(() =>
      evidence.addVersion(auditor, id, { storageKey: 'k', fileName: 'c.csv', fileSize: 10, mimeType: 'text/csv', sha256: good }),
    )
    // Mark the version scanned so it is downloadable.
    await prisma.evidenceVersion.updateMany({ where: { evidenceId: id }, data: { scanStatus: 'BERSIH' } })

    await expect(
      asAuditor(() => evidence.verifyForDownload(auditor, id, sha('tampered'))),
    ).rejects.toThrow(/tidak cocok/i)

    const ok = await asAuditor(() => evidence.verifyForDownload(auditor, id, good))
    expect(ok.fileName).toBe('c.csv')
  })
})

describe('FR-A-016 / FR-A-017 · findings', () => {
  it('TC-IN-A-050 · a finding needs evidence, gets an SLA, and closes only by AUDIT_LEAD', async () => {
    const eid = await newEngagement()
    const { id: evidenceId } = await asAuditor(() =>
      evidence.create(auditor, {
        title: 'Bukti pendukung temuan',
        evidenceType: 'LAPORAN_SISTEM',
        classification: 'TERBATAS',
        source: 'UNGGAHAN_MANUAL',
      }),
    )
    createdEvidenceIds.push(evidenceId)

    // No evidence -> refused.
    await expect(
      asAuditor(() =>
        findings.create(auditor, eid, {
          title: 'Temuan tanpa bukti',
          conditionText: 'Kondisi.',
          riskLevel: 'TINGGI',
        }, []),
      ),
    ).rejects.toThrow(/minimal satu bukti/i)

    const { id: findingId } = await asAuditor(() =>
      findings.create(auditor, eid, {
        title: 'Hak akses berlebih',
        conditionText: 'Tiga akun memegang akses yang tidak lagi diperlukan.',
        riskLevel: 'TINGGI',
      }, [evidenceId]),
    )

    const detail = await asAuditor(() => findings.findOne(auditor, findingId))
    expect(detail.status).toBe('DRAF')
    expect(detail.due_date).not.toBeNull() // SLA-derived

    // Walk to MENUNGGU_VERIFIKASI.
    for (const to of ['DIKOMUNIKASIKAN', 'DISEPAKATI', 'DALAM_PERBAIKAN', 'MENUNGGU_VERIFIKASI'] as const) {
      await asAuditor(() => findings.transition(auditor, findingId, to, undefined))
    }

    // Auditor cannot close.
    await expect(
      asAuditor(() => findings.transition(auditor, findingId, 'DITUTUP', undefined)),
    ).rejects.toThrow(/AUDIT_LEAD/i)

    // AUDIT_LEAD closes (evidence is linked to the finding).
    const closed = await asLead(() => findings.transition(lead, findingId, 'DITUTUP', undefined))
    expect(closed.status).toBe('DITUTUP')
  })
})

describe('FR-A-015 · retention and legal hold', () => {
  it('TC-IN-A-060 · deletion is refused before retention and under legal hold, allowed after', async () => {
    const { id } = await asAuditor(() =>
      evidence.create(auditor, {
        title: 'Bukti uji retensi',
        evidenceType: 'LAPORAN_SISTEM',
        classification: 'INTERNAL',
        source: 'UNGGAHAN_MANUAL',
      }),
    )
    createdEvidenceIds.push(id)
    const compliance: Principal = {
      userId: ids.lead,
      externalId: `lead-${suffix}`,
      employeeId: ids.leadEmp,
      fullName: 'Compliance Uji',
      roles: ['COMPLIANCE'],
      permissions: ['control:read', 'control:write'],
      scopes: {},
      delegatedFrom: [],
    }
    async function asCompliance<T>(fn: () => Promise<T>): Promise<T> {
      return runWithRequestContext(ctx(ids.lead, ['COMPLIANCE']), fn)
    }

    // Not past retention (retentionUntil is null) -> refused.
    await expect(
      asCompliance(() => evidence.approveDeletion(compliance, id, 'Sudah tidak diperlukan lagi.')),
    ).rejects.toThrow(/belum melewati masa retensi/i)

    // Backdate retention to the past to simulate an engagement closed long ago.
    await prisma.evidence.update({
      where: { id },
      data: { retentionUntil: new Date('2020-01-01') },
    })

    // Now it appears in the deletion queue.
    const queue = await asCompliance(() => evidence.deletionQueue(compliance))
    expect(queue.some((q) => q.id === id)).toBe(true)

    // Put it under legal hold -> deletion refused, and it leaves the queue.
    await asCompliance(() => evidence.setLegalHold(compliance, id, true, 'Terkait sengketa hukum berjalan.'))
    await expect(
      asCompliance(() => evidence.approveDeletion(compliance, id, 'Sudah tidak diperlukan lagi.')),
    ).rejects.toThrow(/legal hold/i)
    const queueUnderHold = await asCompliance(() => evidence.deletionQueue(compliance))
    expect(queueUnderHold.some((q) => q.id === id)).toBe(false)

    // Lift the hold, then deletion is approved and tombstoned.
    await asCompliance(() => evidence.setLegalHold(compliance, id, false, 'Sengketa telah selesai.'))
    await asCompliance(() => evidence.approveDeletion(compliance, id, 'Melewati masa retensi 10 tahun.'))
    const after = await prisma.evidence.findUnique({
      where: { id },
      select: { deletionApprovedAt: true, status: true },
    })
    expect(after?.deletionApprovedAt).not.toBeNull()
    expect(after?.status).toBe('DIARSIPKAN')
  })
})
