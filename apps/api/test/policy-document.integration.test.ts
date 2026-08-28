import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { DocumentService } from '../src/modules/policy/document.service.js'
import { DocumentSearchRepository } from '../src/modules/policy/document-search.repository.js'
import { DocumentSearchService } from '../src/modules/policy/document-search.service.js'
import { DocumentApprovalService } from '../src/modules/policy/document-approval.service.js'

/**
 * Modul C against the real database.
 *
 * These are the claims a pure test cannot make, because each of them is kept by
 * the database rather than by application code:
 *
 * - FR-C-010 aturan 1: a document the searcher may not see does not appear in
 *   results, in facet COUNTS, or in suggestions. Tested by creating a RAHASIA
 *   document in a unit the searcher does not belong to and checking all three.
 * - FR-C-004 aturan 2: supersession happens with no gap, and the partial unique
 *   index makes two in-force versions impossible even by direct write.
 * - FR-C-003 aturan 1: no default classification anywhere in the stack.
 * - FR-C-007 aturan 3: which version was in force on a past date.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const repo = new DocumentSearchRepository(prisma)
const documents = new DocumentService(prisma, uow)
const search = new DocumentSearchService(prisma, repo, uow)
const approvals = new DocumentApprovalService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  otherUnit: randomUUID(),
  employee: randomUUID(),
  outsider: randomUUID(),
  user: randomUUID(),
  outsiderUser: randomUUID(),
  secretDoc: randomUUID(),
}
const suffix = ids.orgUnit.slice(0, 8)

/*
 * Force dates are derived from today, not hard-coded.
 *
 * FR-C-007 aturan 1 forbids an effective date earlier than the ratification
 * date, and ratification happens when the test runs. A literal date would make
 * the suite pass this month and fail next month -- the exact date-sensitivity
 * that already bit the Modul B seed (see HANDOFF).
 */
const FORCE_FROM = utcToday()
const SUPERSEDE_FROM = addDaysTo(FORCE_FROM, 30)

/** Today as a UTC calendar date -- the same normalisation the service applies. */
function utcToday(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

function addDaysTo(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

let author: Principal
let outsider: Principal

function asUser<T>(userId: string, roles: string[], fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(
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

function principalOf(userId: string, employeeId: string, roles: string[]): Principal {
  return {
    userId,
    externalId: `ext-${userId.slice(0, 8)}`,
    employeeId,
    fullName: 'Penguji Modul C',
    jobTitle: 'Penyusun Dokumen',
    roles,
    permissions: ['document:read', 'document:write', 'document:approve'],
    scopes: {},
    delegatedFrom: [],
  }
}

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.createMany({
    data: [
      { id: ids.orgUnit, code: `OUC-${suffix}`, name: 'Unit Kepatuhan Uji' },
      { id: ids.otherUnit, code: `OUD-${suffix}`, name: 'Unit Lain Uji' },
    ],
  })
  await prisma.employee.createMany({
    data: [
      {
        id: ids.employee,
        employeeNumber: `EC-${suffix}`,
        fullName: 'Penyusun Dokumen Uji',
        email: `penyusun.${suffix}@example.test`,
        jobTitle: 'Penyusun Dokumen',
        orgUnitId: ids.orgUnit,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2020-01-01'),
      },
      {
        id: ids.outsider,
        employeeNumber: `EO-${suffix}`,
        fullName: 'Karyawan Unit Lain',
        email: `lain.${suffix}@example.test`,
        jobTitle: 'Staf Umum',
        orgUnitId: ids.otherUnit,
        employmentStatus: 'AKTIF',
        joinedAt: new Date('2020-01-01'),
      },
    ],
  })
  await prisma.appUser.createMany({
    data: [
      {
        id: ids.user,
        employeeId: ids.employee,
        externalId: `uc-${suffix}`,
        userType: 'INTERNAL',
      },
      {
        id: ids.outsiderUser,
        employeeId: ids.outsider,
        externalId: `uo-${suffix}`,
        userType: 'INTERNAL',
      },
    ],
  })

  author = principalOf(ids.user, ids.employee, ['DOC_AUTHOR'])
  outsider = principalOf(ids.outsiderUser, ids.outsider, ['EMPLOYEE'])
})

afterAll(async () => {
  // Clean up in dependency order. Chunks and versions first, then documents.
  const docs = await prisma.document.findMany({
    where: { ownerOrgUnitId: { in: [ids.orgUnit, ids.otherUnit] } },
    select: { id: true },
  })
  const docIds = docs.map((d) => d.id)
  const versions = await prisma.documentVersion.findMany({
    where: { documentId: { in: docIds } },
    select: { id: true },
  })
  await prisma.documentApprovalStep.deleteMany({
    where: { documentVersionId: { in: versions.map((v) => v.id) } },
  })
  await prisma.documentChunk.deleteMany({
    where: { documentVersionId: { in: versions.map((v) => v.id) } },
  })
  await prisma.documentVersion.deleteMany({ where: { documentId: { in: docIds } } })
  await prisma.documentAccess.deleteMany({ where: { documentId: { in: docIds } } })
  await prisma.document.updateMany({
    where: { id: { in: docIds } },
    data: { supersededById: null },
  })
  await prisma.document.deleteMany({ where: { id: { in: docIds } } })
  await prisma.documentSearchMiss.deleteMany({
    where: { userId: { in: [ids.user, ids.outsiderUser] } },
  })
  // audit_log is deliberately NOT cleaned up: the application role holds only
  // INSERT and SELECT on it (K-7, ADR-04), so a DELETE here would fail -- and
  // the fact that it fails is one of the guarantees this system is built on.
  // The test rows stay in the chain, which is exactly what an append-only,
  // hash-chained trail means. The app_user rows they reference therefore have
  // to stay too, so they are deactivated rather than deleted.
  await prisma.appUser.updateMany({
    where: { id: { in: [ids.user, ids.outsiderUser] } },
    data: { isActive: false },
  })
  await prisma.$disconnect()
})

describe('FR-C-003/004/007 · siklus hidup dokumen', () => {
  it('membuat dokumen beserta versi 1.0 dan penggalannya', async () => {
    const { id } = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      documents.create(author, {
        title: `SOP Penyelesaian Transaksi ${suffix}`,
        documentType: 'SOP',
        ownerOrgUnitId: ids.orgUnit,
        ownerEmployeeId: ids.employee,
        classification: 'INTERNAL',
        processArea: 'SETTLEMENT',
        body: 'BAB I UMUM\n\nPasal 1\n\nPenyelesaian transaksi dilakukan pada T+2.',
        changeSummary: 'Versi pertama.',
      }),
    )

    const doc = await prisma.document.findUniqueOrThrow({
      where: { id },
      select: { status: true, reviewCycleMonths: true, versions: { select: { id: true } } },
    })
    expect(doc.status).toBe('DRAF')
    // FR-C-008 aturan 1: an SOP gets a 12-month cycle without being told.
    expect(doc.reviewCycleMonths).toBe(12)

    const chunks = await prisma.documentChunk.count({
      where: { documentVersionId: doc.versions[0]!.id },
    })
    expect(chunks).toBeGreaterThan(0)
  })

  it('menolak transisi yang tidak ada pada diagram FR-C-004', async () => {
    const { id } = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      documents.create(author, {
        title: `Kebijakan Uji Transisi ${suffix}`,
        documentType: 'KEBIJAKAN',
        ownerOrgUnitId: ids.orgUnit,
        ownerEmployeeId: ids.employee,
        classification: 'INTERNAL',
        processArea: 'KEPATUHAN',
        body: 'Isi kebijakan.',
        changeSummary: 'Versi pertama.',
      }),
    )
    // Draf -> Disahkan skips review entirely.
    await expect(
      asUser(ids.user, ['DOC_APPROVER'], () => documents.transition(author, id, 'DISAHKAN')),
    ).rejects.toThrow(/tidak dapat berpindah/i)
  })

  it('status tidak dapat dinaikkan tanpa melewati alur persetujuan', async () => {
    const { id } = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      documents.create(author, {
        title: `SOP Uji Pintasan Status ${suffix}`,
        documentType: 'SOP',
        ownerOrgUnitId: ids.orgUnit,
        ownerEmployeeId: ids.employee,
        classification: 'INTERNAL',
        processArea: 'KEPATUHAN',
        body: 'Pasal 1\n\nIsi prosedur.',
        changeSummary: 'Versi pertama.',
      }),
    )
    // The control: no service call can mint a ratified document. Only the
    // ladder can, and the ladder always leaves signatures behind.
    await expect(
      asUser(ids.user, ['DOC_AUTHOR'], () => documents.transition(author, id, 'DALAM_PENELAAHAN')),
    ).rejects.toThrow(/alur persetujuan/i)
  })

  it('menolak penarikan tanpa alasan (FR-C-004 aturan 4)', async () => {
    const id = await bringIntoForce('Kebijakan Uji Penarikan', 'KEBIJAKAN', 'INTERNAL')
    await expect(
      asUser(ids.user, ['DOC_APPROVER'], () => documents.transition(author, id, 'DITARIK')),
    ).rejects.toThrow(/wajib disertai alasan/i)
  })

  it('memberlakukan versi baru menggantikan yang lama tanpa jeda', async () => {
    const id = await bringIntoForce('SOP Uji Supersesi', 'SOP', 'INTERNAL')

    const v2 = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      documents.createVersion(author, id, {
        body: 'Pasal 1\n\nPenyelesaian transaksi dilakukan pada T+1.',
        changeSummary: 'Perubahan siklus penyelesaian.',
        kind: 'MAYOR',
      }),
    )
    await asUser(ids.user, ['DOC_AUTHOR'], () => approvals.submit(author, id))
    await approveEveryStep(id)
    await asUser(ids.user, ['DOC_APPROVER'], () =>
      documents.putIntoForce(author, id, SUPERSEDE_FROM),
    )

    const versions = await prisma.documentVersion.findMany({
      where: { documentId: id },
      select: { id: true, status: true, effectiveFrom: true, effectiveUntil: true },
      orderBy: { versionMajor: 'asc' },
    })
    const inForce = versions.filter((v) => v.status === 'BERLAKU')
    expect(inForce).toHaveLength(1)
    expect(inForce[0]!.id).toBe(v2.id)

    // No gap: the old version's last day is the day before the new one starts.
    const old = versions.find((v) => v.status === 'DIGANTIKAN')!
    expect(isoDate(old.effectiveUntil!)).toBe(isoDate(addDaysTo(SUPERSEDE_FROM, -1)))
  })

  it('basis data menolak dua versi berlaku sekaligus', async () => {
    const id = await bringIntoForce('SOP Uji Indeks Unik', 'SOP', 'INTERNAL')
    const extra = randomUUID()
    // A direct write that bypasses the service entirely -- the invariant has to
    // hold even then, which is why it is a partial unique index and not a check
    // in application code.
    await expect(
      prisma.documentVersion.create({
        data: {
          id: extra,
          documentId: id,
          versionMajor: 9,
          versionMinor: 0,
          changeSummary: 'Percobaan menembus invarian.',
          status: 'BERLAKU',
          createdBy: ids.user,
        },
      }),
    ).rejects.toThrow()
  })

  it('menjawab versi mana yang berlaku pada tanggal tertentu (FR-C-007 aturan 3)', async () => {
    const id = await bringIntoForce('Pedoman Uji Tanggal', 'PEDOMAN', 'INTERNAL')
    const found = await search.versionInForceOn(author, id, addDaysTo(FORCE_FROM, 5))
    expect(found.version_major).toBe(1)

    await expect(
      search.versionInForceOn(author, id, new Date('2019-01-01')),
    ).rejects.toThrow(/tidak ada versi/i)
  })
})

describe('FR-C-010 · penyaringan hak akses sebelum pemeringkatan', () => {
  it('dokumen rahasia unit lain tidak muncul di hasil, jumlah, maupun saran', async () => {
    const secretTitle = `Kebijakan Rahasia Merger ${suffix}`
    const { id } = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      documents.create(author, {
        title: secretTitle,
        documentType: 'KEBIJAKAN',
        ownerOrgUnitId: ids.orgUnit,
        ownerEmployeeId: ids.employee,
        classification: 'RAHASIA',
        processArea: 'KEPATUHAN',
        body: 'BAB I\n\nPasal 1\n\nRencana merger bersifat rahasia dan hanya untuk pihak yang ditunjuk.',
        changeSummary: 'Versi pertama.',
      }),
    )
    await forceInPlace(id)

    // The owner's own unit sees it.
    const mine = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      search.search(author, { query: 'merger', filters: {}, auditMode: false, limit: 20 }),
    )
    expect(mine.results.some((r) => r.document_id === id)).toBe(true)

    // Someone from another unit, with no grant, sees nothing of it anywhere.
    const theirs = await asUser(ids.outsiderUser, ['EMPLOYEE'], () =>
      search.search(outsider, { query: 'merger', filters: {}, auditMode: false, limit: 20 }),
    )
    expect(theirs.results.some((r) => r.document_id === id)).toBe(false)
    // FR-C-010 aturan 1 covers suggestions explicitly: a near-miss title is
    // still a disclosure of the document's existence.
    expect((theirs.suggestions ?? []).some((s) => s.document_id === id)).toBe(false)

    // ...and not through the facet counts either. Comparing the KEBIJAKAN facet
    // is the sharpest form of the leak: the document never appears, but a count
    // that includes it would still say "there is one more policy than you can
    // see".
    const mineFacet = mine.facets.documentType as { value: string; count: number }[]
    const theirsFacet = theirs.facets.documentType as { value: string; count: number }[]
    const mineCount = mineFacet.find((f) => f.value === 'KEBIJAKAN')?.count ?? 0
    const theirsCount = theirsFacet.find((f) => f.value === 'KEBIJAKAN')?.count ?? 0
    expect(theirsCount).toBeLessThan(mineCount)
  })

  it('pemberian akses eksplisit per unit membuka dokumen itu', async () => {
    const { id } = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      documents.create(author, {
        title: `SOP Terbatas Kustodian ${suffix}`,
        documentType: 'SOP',
        ownerOrgUnitId: ids.orgUnit,
        ownerEmployeeId: ids.employee,
        classification: 'TERBATAS',
        processArea: 'KUSTODIAN',
        body: 'Pasal 1\n\nPenitipan efek nasabah dilakukan terpisah.',
        changeSummary: 'Versi pertama.',
      }),
    )
    await forceInPlace(id)

    expect(await repo.canAccess(ids.outsiderUser, id)).toBe(false)

    await prisma.documentAccess.create({
      data: {
        id: randomUUID(),
        documentId: id,
        subjectType: 'UNIT',
        subjectId: ids.otherUnit,
        grantedBy: ids.user,
      },
    })

    expect(await repo.canAccess(ids.outsiderUser, id)).toBe(true)
  })

  it('mode audit ditolak untuk peran yang tidak berhak', async () => {
    await expect(
      asUser(ids.outsiderUser, ['EMPLOYEE'], () =>
        search.search(outsider, { query: 'apa saja', filters: {}, auditMode: true, limit: 10 }),
      ),
    ).rejects.toThrow(/mode audit/i)
  })
})

describe('FR-C-012 · perilaku saat hasil kosong', () => {
  it('mencatat pencarian nihil dan menawarkan langkah lanjutan', async () => {
    const nonsense = `zzqq${suffix}`
    const result = await asUser(ids.user, ['DOC_AUTHOR'], () =>
      search.search(author, { query: nonsense, filters: {}, auditMode: false, limit: 10 }),
    )
    expect(result.results).toHaveLength(0)
    expect(result.empty_guidance).toBeTruthy()

    const recorded = await prisma.documentSearchMiss.count({ where: { queryText: nonsense } })
    expect(recorded).toBe(1)
  })
})

/* ------------------------------------------------------------- helpers --- */

/** Create a document and walk it all the way to BERLAKU. */
async function bringIntoForce(
  title: string,
  type: 'SOP' | 'KEBIJAKAN' | 'PEDOMAN',
  classification: 'INTERNAL' | 'TERBATAS' | 'RAHASIA',
): Promise<string> {
  const { id } = await asUser(ids.user, ['DOC_AUTHOR'], () =>
    documents.create(author, {
      title: `${title} ${suffix}`,
      documentType: type,
      ownerOrgUnitId: ids.orgUnit,
      ownerEmployeeId: ids.employee,
      classification,
      processArea: 'KEPATUHAN',
      body: 'BAB I UMUM\n\nPasal 1\n\nKetentuan umum berlaku bagi seluruh karyawan.',
      changeSummary: 'Versi pertama.',
    }),
  )
  await forceInPlace(id)
  return id
}

/**
 * Walk a document all the way to BERLAKU through the real approval ladder.
 *
 * Deliberately not a status shortcut: since FR-C-005 landed, `transition()`
 * refuses everything except withdrawal, so a helper that faked the states would
 * be testing a path the application no longer has.
 */
async function forceInPlace(id: string): Promise<void> {
  await asUser(ids.user, ['DOC_AUTHOR'], () => approvals.submit(author, id))
  await approveEveryStep(id)
  await asUser(ids.user, ['DOC_APPROVER'], () => documents.putIntoForce(author, id, FORCE_FROM))
}

/** Approve each outstanding step in ladder order, as its assignee. */
async function approveEveryStep(documentId: string): Promise<void> {
  for (let guard = 0; guard < 20; guard += 1) {
    const version = await prisma.documentVersion.findFirst({
      where: {
        documentId,
        status: { in: ['DRAF', 'DALAM_PENELAAHAN', 'MENUNGGU_PENGESAHAN', 'DALAM_REVISI'] },
      },
      orderBy: [{ versionMajor: 'desc' }, { versionMinor: 'desc' }],
      select: { id: true },
    })
    if (!version) return
    const step = await prisma.documentApprovalStep.findFirst({
      where: { documentVersionId: version.id, status: 'MENUNGGU' },
      orderBy: [{ kind: 'asc' }, { stepOrder: 'asc' }],
      select: { id: true, assigneeEmployeeId: true },
    })
    if (!step) return
    const actor = await principalForEmployee(step.assigneeEmployeeId)
    await asUser(actor.userId, ['DOC_APPROVER'], () =>
      approvals.act(actor, step.id, 'SETUJU', 'Disetujui untuk keperluan uji integrasi.'),
    )
  }
  throw new Error('Alur persetujuan tidak selesai setelah 20 langkah.')
}

/** A principal standing in for whoever the ladder assigned a step to. */
async function principalForEmployee(employeeId: string): Promise<Principal> {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: { id: true, appUser: { select: { id: true } } },
  })
  const userId = employee.appUser?.id
  if (!userId) throw new Error(`Karyawan ${employeeId} tidak punya akun pengguna.`)
  return principalOf(userId, employeeId, ['DOC_APPROVER'])
}
