import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { AttestationService } from '../src/modules/policy/attestation.service.js'

/**
 * FR-C-019 s.d. FR-C-021 · attestation, against the real database.
 *
 * What is worth asserting here is what makes the record evidence rather than a
 * checkbox:
 *
 * - only documents in force may be attested to (FR-C-019 aturan 1);
 * - a campaign with no targets is refused, because it would report 100%
 *   complete on day one without anyone reading anything;
 * - the record names the VERSION, and a mid-campaign revision is detected and
 *   decided by a human (aturan 2);
 * - the server, not the client, enforces the viewing gate (FR-C-020);
 * - an attestation cannot be withdrawn, and the DATABASE GRANT is what
 *   guarantees it (aturan 3);
 * - progress counts obligations, so people who have not acted are visible;
 * - the report freezes into Modul A evidence (FR-C-021 aturan 2).
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const attestations = new AttestationService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  otherUnit: randomUUID(),
  officer: randomUUID(),
  staffA: randomUUID(),
  staffB: randomUUID(),
  officerUser: randomUUID(),
  staffAUser: randomUUID(),
  staffBUser: randomUUID(),
  document: randomUUID(),
  versionOne: randomUUID(),
  versionTwo: randomUUID(),
  draftDocument: randomUUID(),
  draftVersion: randomUUID(),
}
const suffix = ids.orgUnit.slice(0, 8)

let officer: Principal
let staffA: Principal
let staffB: Principal

function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(
    {
      requestId: randomUUID(),
      actorId: userId,
      actorRoles: ['COMPLIANCE'],
      sessionId: null,
      ipAddress: '127.0.0.1',
    },
    fn,
  )
}

function principalOf(userId: string, employeeId: string): Principal {
  return {
    userId,
    externalId: `ext-${userId.slice(0, 8)}`,
    employeeId,
    fullName: 'Penguji Attestation',
    jobTitle: 'Penguji',
    roles: ['COMPLIANCE'],
    permissions: ['attestation:manage', 'document:read'],
    scopes: {},
    delegatedFrom: [],
  }
}

/** Long enough to trip the scroll-to-end requirement (FR-C-020 aturan 2). */
const LONG_BODY = Array.from({ length: 60 }, (_, i) => `Pasal ${i} tentang sesuatu.`).join('\n')

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.createMany({
    data: [
      { id: ids.orgUnit, code: `OUT-${suffix}`, name: 'Unit Uji Attestation' },
      { id: ids.otherUnit, code: `OUX-${suffix}`, name: 'Unit Lain Attestation' },
    ],
  })

  const people: [string, string, string, string, string][] = [
    [ids.officer, ids.officerUser, 'Petugas Kepatuhan Uji', 'Compliance Officer', ids.orgUnit],
    [ids.staffA, ids.staffAUser, 'Staf Satu', 'Dealer', ids.orgUnit],
    [ids.staffB, ids.staffBUser, 'Staf Dua', 'Dealer', ids.otherUnit],
  ]
  for (const [employeeId, userId, name, jobTitle, unit] of people) {
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeNumber: `ET-${employeeId.slice(0, 8)}`,
        fullName: name,
        email: `${employeeId.slice(0, 8)}@example.test`,
        jobTitle,
        orgUnitId: unit,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2021-01-01'),
      },
    })
    await prisma.appUser.create({
      data: { id: userId, employeeId, externalId: `ut-${employeeId.slice(0, 8)}`, userType: 'INTERNAL' },
    })
  }

  // A document in force, on version 1.0.
  await prisma.document.create({
    data: {
      id: ids.document,
      documentNo: `SOP-AT-${suffix}`,
      title: `SOP Wajib Dibaca ${suffix}`,
      documentType: 'SOP',
      ownerOrgUnitId: ids.orgUnit,
      ownerEmployeeId: ids.officer,
      classification: 'INTERNAL',
      processArea: 'KEPATUHAN',
      reviewCycleMonths: 12,
      status: 'BERLAKU',
      createdBy: ids.officerUser,
    },
  })
  await prisma.documentVersion.create({
    data: {
      id: ids.versionOne,
      documentId: ids.document,
      versionMajor: 1,
      versionMinor: 0,
      body: LONG_BODY,
      changeSummary: 'Versi pertama.',
      status: 'BERLAKU',
      effectiveFrom: daysAgo(30),
      createdBy: ids.officerUser,
    },
  })

  // A draft document, to prove aturan 1 refuses it.
  await prisma.document.create({
    data: {
      id: ids.draftDocument,
      documentNo: `SOP-DRAF-${suffix}`,
      title: `SOP Masih Draf ${suffix}`,
      documentType: 'SOP',
      ownerOrgUnitId: ids.orgUnit,
      ownerEmployeeId: ids.officer,
      classification: 'INTERNAL',
      processArea: 'KEPATUHAN',
      reviewCycleMonths: 12,
      status: 'DRAF',
      createdBy: ids.officerUser,
    },
  })
  await prisma.documentVersion.create({
    data: {
      id: ids.draftVersion,
      documentId: ids.draftDocument,
      versionMajor: 1,
      versionMinor: 0,
      body: 'Isi draf.',
      changeSummary: 'Draf.',
      status: 'DRAF',
      createdBy: ids.officerUser,
    },
  })

  officer = principalOf(ids.officerUser, ids.officer)
  staffA = principalOf(ids.staffAUser, ids.staffA)
  staffB = principalOf(ids.staffBUser, ids.staffB)
})

afterAll(async () => {
  const campaigns = await prisma.attestationCampaign.findMany({
    where: { createdBy: ids.officerUser },
    select: { id: true },
  })
  const campaignIds = campaigns.map((c) => c.id)
  /*
   * Only tasks with no attestation are removed.
   *
   * attestation_record has no DELETE grant (FR-C-020 aturan 3), so a task that
   * was attested to cannot be deleted either -- its record references it and
   * the foreign key holds. That is not an inconvenience to work around: it is
   * the guarantee under test, reaching one level further than intended and
   * making an attested obligation as durable as the statement about it. The
   * rows stay, exactly as an attestation trail should.
   */
  const deletable = await prisma.attestationTask.findMany({
    where: { campaignId: { in: campaignIds }, records: { none: {} } },
    select: { id: true },
  })
  await prisma.attestationTask.deleteMany({ where: { id: { in: deletable.map((t) => t.id) } } })
  await prisma.$disconnect()
})

describe('FR-C-019 · kampanye attestation', () => {
  it('menolak dokumen yang belum berlaku', async () => {
    await expect(
      asUser(ids.officerUser, () =>
        attestations.create(officer, {
          name: `Kampanye Draf ${suffix}`,
          documentIds: [ids.draftDocument],
          targetKind: 'SELURUH_KARYAWAN',
          targetParams: {},
          startDate: new Date(),
          dueDate: daysFromNow(14),
          isMandatory: true,
          autoEnrollNewEmployees: false,
        }),
      ),
    ).rejects.toThrow(/berstatus Berlaku/i)
  })

  it('menolak kriteria sasaran yang tidak menghasilkan siapa pun', async () => {
    const { id } = await createCampaign('DAFTAR_INDIVIDU', { employee_ids: [randomUUID()] })
    // A campaign with no targets would report 100% complete on day one --
    // evidence of compliance nobody demonstrated.
    await expect(asUser(ids.officerUser, () => attestations.launch(officer, id))).rejects.toThrow(
      /tidak menghasilkan satu karyawan pun/i,
    )
  })

  it('meluncurkan kampanye dan membentuk satu tugas per sasaran per dokumen', async () => {
    const { id } = await createCampaign('UNIT', { org_unit_ids: [ids.orgUnit] })
    const result = await asUser(ids.officerUser, () => attestations.launch(officer, id))
    // Only the two employees in the targeted unit; staffB is elsewhere.
    expect(result.tasks).toBe(2)

    const campaign = await prisma.attestationCampaign.findUniqueOrThrow({
      where: { id },
      select: { status: true, launchedAt: true },
    })
    expect(campaign.status).toBe('BERJALAN')
    expect(campaign.launchedAt).not.toBeNull()
  })

  it('menolak peluncuran kampanye yang sudah berjalan', async () => {
    const { id } = await createCampaign('UNIT', { org_unit_ids: [ids.orgUnit] })
    await asUser(ids.officerUser, () => attestations.launch(officer, id))
    await expect(asUser(ids.officerUser, () => attestations.launch(officer, id))).rejects.toThrow(
      /berstatus Draf/i,
    )
  })
})

describe('FR-C-020 · pencatatan pernyataan', () => {
  it('menolak pernyataan tanpa dokumen benar-benar dibuka', async () => {
    const task = await launchAndTakeTask(ids.staffA)
    await expect(
      asUser(ids.staffAUser, () =>
        attestations.attest(staffA, task.id, {
          secondsViewed: 0,
          reachedEnd: true,
          ipAddress: '10.0.0.1',
        }),
      ),
    ).rejects.toThrow(/belum benar-benar dibuka/i)
  })

  it('menuntut gulir sampai akhir untuk dokumen panjang', async () => {
    const task = await launchAndTakeTask(ids.staffA)
    await expect(
      asUser(ids.staffAUser, () =>
        attestations.attest(staffA, task.id, {
          secondsViewed: 60,
          reachedEnd: false,
          ipAddress: '10.0.0.1',
        }),
      ),
    ).rejects.toThrow(/gulir sampai bagian akhir/i)
  })

  it('mencatat pernyataan beserta versi, IP, dan lama dibuka', async () => {
    const task = await launchAndTakeTask(ids.staffA)
    const { id } = await asUser(ids.staffAUser, () =>
      attestations.attest(staffA, task.id, {
        secondsViewed: 90,
        reachedEnd: true,
        ipAddress: '10.0.0.7',
      }),
    )

    const record = await prisma.attestationRecord.findUniqueOrThrow({
      where: { id },
      select: {
        documentVersionId: true,
        secondsViewed: true,
        reachedEnd: true,
        ipAddress: true,
        employeeId: true,
      },
    })
    // The VERSION, not the document: someone who read 1.0 has not read 2.0.
    expect(record.documentVersionId).toBe(ids.versionOne)
    expect(record.secondsViewed).toBe(90)
    expect(record.ipAddress).toBe('10.0.0.7')
    expect(record.employeeId).toBe(ids.staffA)

    const after = await prisma.attestationTask.findUniqueOrThrow({
      where: { id: task.id },
      select: { status: true },
    })
    expect(after.status).toBe('SELESAI')
  })

  it('tidak dapat menyatakan dua kali', async () => {
    const task = await launchAndTakeTask(ids.staffA)
    const ok = { secondsViewed: 30, reachedEnd: true, ipAddress: '10.0.0.1' }
    await asUser(ids.staffAUser, () => attestations.attest(staffA, task.id, ok))
    await expect(
      asUser(ids.staffAUser, () => attestations.attest(staffA, task.id, ok)),
    ).rejects.toThrow(/sudah menyatakan/i)
  })

  it('tidak dapat menyatakan atas nama orang lain', async () => {
    const task = await launchAndTakeTask(ids.staffA)
    // 404, not 403: the task names a document whose existence may be secret.
    await expect(
      asUser(ids.staffBUser, () =>
        attestations.attest(staffB, task.id, {
          secondsViewed: 30,
          reachedEnd: true,
          ipAddress: '10.0.0.2',
        }),
      ),
    ).rejects.toThrow(/tidak ditemukan/i)
  })

  it('basis data menolak PENGHAPUSAN pernyataan (aturan 3)', async () => {
    const task = await launchAndTakeTask(ids.staffA)
    const { id } = await asUser(ids.staffAUser, () =>
      attestations.attest(staffA, task.id, {
        secondsViewed: 30,
        reachedEnd: true,
        ipAddress: '10.0.0.1',
      }),
    )
    // The application role holds INSERT and SELECT only. A statement people can
    // quietly delete is not evidence of anything.
    await expect(prisma.attestationRecord.delete({ where: { id } })).rejects.toThrow()
  })
})

describe('FR-C-019 aturan 2 · dokumen berganti versi di tengah kampanye', () => {
  it('mendeteksi perubahan versi dan membuka kembali pernyataan bila diputuskan', async () => {
    const { id: campaignId } = await createCampaign('UNIT', { org_unit_ids: [ids.orgUnit] })
    await asUser(ids.officerUser, () => attestations.launch(officer, campaignId))

    const task = await prisma.attestationTask.findFirstOrThrow({
      where: { campaignId, employeeId: ids.staffA },
      select: { id: true, campaignDocumentId: true },
    })
    await asUser(ids.staffAUser, () =>
      attestations.attest(staffA, task.id, {
        secondsViewed: 45,
        reachedEnd: true,
        ipAddress: '10.0.0.1',
      }),
    )

    // A new version takes force mid-campaign.
    await prisma.documentVersion.updateMany({
      where: { documentId: ids.document, status: 'BERLAKU' },
      data: { status: 'DIGANTIKAN', effectiveUntil: daysAgo(1) },
    })
    await prisma.documentVersion.create({
      data: {
        id: ids.versionTwo,
        documentId: ids.document,
        versionMajor: 2,
        versionMinor: 0,
        body: LONG_BODY.replace('Pasal 3 tentang sesuatu.', 'Pasal 3 berubah total.'),
        changeSummary: 'Perubahan substansi.',
        status: 'BERLAKU',
        effectiveFrom: new Date(),
        createdBy: ids.officerUser,
      },
    })

    const changed = await attestations.detectSupersededDocuments(campaignId)
    expect(changed).toHaveLength(1)
    expect(changed[0]!.current_version).toBe('2.0')

    const decision = await asUser(ids.officerUser, () =>
      attestations.decideReattestation(officer, task.campaignDocumentId, true),
    )
    expect(decision.reopened).toBe(1)

    const reopened = await prisma.attestationTask.findUniqueOrThrow({
      where: { id: task.id },
      select: { status: true },
    })
    expect(reopened.status).toBe('PERLU_NYATAKAN_ULANG')

    // The earlier record still names version 1.0: that people read different
    // text at different times is exactly what must not be erased.
    const records = await prisma.attestationRecord.findMany({
      where: { taskId: task.id },
      select: { documentVersionId: true },
    })
    expect(records.every((r) => r.documentVersionId === ids.versionOne)).toBe(true)

    // Restore for the remaining tests. Version 2.0 is NOT deleted: the
    // campaign document now pins it, and attestation records may reference it.
    // Marking it superseded and putting 1.0 back in force is the honest way to
    // rewind, and it keeps the partial unique index (one BERLAKU per document)
    // satisfied at every step.
    await prisma.documentVersion.update({
      where: { id: ids.versionTwo },
      data: { status: 'DIGANTIKAN', effectiveUntil: daysAgo(0) },
    })
    await prisma.documentVersion.update({
      where: { id: ids.versionOne },
      data: { status: 'BERLAKU', effectiveUntil: null },
    })
  })
})

describe('FR-C-021 · pemantauan dan bukti', () => {
  it('menghitung penyelesaian dari kewajiban, bukan dari pernyataan saja', async () => {
    const { id: campaignId } = await createCampaign('SELURUH_KARYAWAN', {})
    await asUser(ids.officerUser, () => attestations.launch(officer, campaignId))

    const before = await attestations.progress(campaignId)
    // Nobody has acted yet, so completion must be 0% -- not 100%, which is what
    // a percentage computed from attestations alone would report.
    expect(before.overall.percent).toBe(0)
    expect(before.overall.outstanding).toBe(before.overall.total)

    const task = await prisma.attestationTask.findFirstOrThrow({
      where: { campaignId, employeeId: ids.staffA },
      select: { id: true },
    })
    await asUser(ids.staffAUser, () =>
      attestations.attest(staffA, task.id, {
        secondsViewed: 30,
        reachedEnd: true,
        ipAddress: '10.0.0.1',
      }),
    )

    const after = await attestations.progress(campaignId)
    expect(after.overall.done).toBe(1)
    // Never 0% while someone has acted, and never 100% while anyone is
    // outstanding. A compliance figure that rounds an outstanding obligation
    // away is worse than an imprecise one.
    expect(after.overall.percent).toBeGreaterThan(0)
    expect(after.overall.percent).toBeLessThan(100)
    // Per unit and per job title, as aturan 1 requires.
    expect(after.by_unit.length).toBeGreaterThan(0)
    expect(after.by_job_title.length).toBeGreaterThan(0)
  })

  it('membangkitkan bukti Modul A dan menutup kampanye', async () => {
    const { id: campaignId } = await createCampaign('UNIT', { org_unit_ids: [ids.orgUnit] })
    await asUser(ids.officerUser, () => attestations.launch(officer, campaignId))

    const { evidenceId } = await asUser(ids.officerUser, () =>
      attestations.generateEvidence(officer, campaignId),
    )

    const evidence = await prisma.evidence.findUniqueOrThrow({
      where: { id: evidenceId },
      select: { evidenceType: true, systemGenerated: true, source: true, status: true },
    })
    expect(evidence.evidenceType).toBe('LAPORAN_ATTESTATION')
    // FR-A-014 aturan 4: system-generated evidence is not user-editable.
    expect(evidence.systemGenerated).toBe(true)
    expect(evidence.source).toBe('DIBANGKITKAN_SISTEM')

    const link = await prisma.evidenceLink.findFirstOrThrow({
      where: { evidenceId },
      select: { targetType: true, targetId: true },
    })
    expect(link.targetType).toBe('ATTESTATION_CAMPAIGN')
    expect(link.targetId).toBe(campaignId)

    const closed = await prisma.attestationCampaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { status: true, closedAt: true },
    })
    // Closing is part of generating: a report from a campaign that keeps
    // accepting attestations is evidence of a number that no longer holds.
    expect(closed.status).toBe('SELESAI')
    expect(closed.closedAt).not.toBeNull()

    await expect(
      asUser(ids.officerUser, () => attestations.generateEvidence(officer, campaignId)),
    ).rejects.toThrow(/kampanye berjalan/i)
  })
})

/* ------------------------------------------------------------- helpers --- */

async function createCampaign(
  targetKind: 'SELURUH_KARYAWAN' | 'UNIT' | 'JABATAN' | 'KARYAWAN_BARU' | 'DAFTAR_INDIVIDU',
  targetParams: Record<string, unknown>,
): Promise<{ id: string }> {
  return asUser(ids.officerUser, () =>
    attestations.create(officer, {
      name: `Kampanye ${targetKind} ${randomUUID().slice(0, 6)}`,
      documentIds: [ids.document],
      targetKind,
      targetParams,
      startDate: new Date(),
      dueDate: daysFromNow(14),
      isMandatory: true,
      autoEnrollNewEmployees: false,
    }),
  )
}

/** A fresh launched campaign, returning the task belonging to `employeeId`. */
async function launchAndTakeTask(employeeId: string) {
  const { id } = await createCampaign('UNIT', { org_unit_ids: [ids.orgUnit] })
  await asUser(ids.officerUser, () => attestations.launch(officer, id))
  return prisma.attestationTask.findFirstOrThrow({
    where: { campaignId: id, employeeId },
    select: { id: true, campaignDocumentId: true },
  })
}

function daysFromNow(days: number): Date {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + days)
  return d
}

function daysAgo(days: number): Date {
  return daysFromNow(-days)
}
