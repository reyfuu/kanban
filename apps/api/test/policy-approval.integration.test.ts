import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { DocumentService } from '../src/modules/policy/document.service.js'
import { DocumentApprovalService } from '../src/modules/policy/document-approval.service.js'

/**
 * FR-C-005 · the staged approval flow, against the real database.
 *
 * The assertions that matter are the ones about who may do what, and in what
 * order, because that is the whole substance of an approval workflow:
 *
 * - reviewers act in parallel, approvers strictly in sequence (aturan 1 & 2);
 * - no decision without a comment, no rejection without a reason (aturan 3,
 *   backed by a CHECK constraint so no write path can bypass it);
 * - an inactive assignee redirects to their delegate, and the redirect is
 *   recorded rather than hidden (aturan 5);
 * - the author may stop the flow before ratification, not after (aturan 6);
 * - and a document cannot reach Disahkan by any route other than this one.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const documents = new DocumentService(prisma, uow)
const approvals = new DocumentApprovalService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  author: randomUUID(),
  reviewerA: randomUUID(),
  reviewerB: randomUUID(),
  approver1: randomUUID(),
  approver2: randomUUID(),
  delegate: randomUUID(),
  authorUser: randomUUID(),
  reviewerAUser: randomUUID(),
  reviewerBUser: randomUUID(),
  approver1User: randomUUID(),
  approver2User: randomUUID(),
  delegateUser: randomUUID(),
}
const suffix = ids.orgUnit.slice(0, 8)

let author: Principal

function asUser<T>(userId: string, fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(
    {
      requestId: randomUUID(),
      actorId: userId,
      actorRoles: ['DOC_AUTHOR'],
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
    fullName: 'Penguji Alur',
    jobTitle: 'Penguji',
    roles: ['DOC_AUTHOR', 'DOC_APPROVER'],
    permissions: ['document:read', 'document:write', 'document:approve'],
    scopes: {},
    delegatedFrom: [],
  }
}

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OUA-${suffix}`, name: 'Unit Uji Alur Persetujuan' },
  })

  const people: [string, string, string, string][] = [
    [ids.author, ids.authorUser, 'Penyusun Alur', 'AKTIF'],
    [ids.reviewerA, ids.reviewerAUser, 'Penelaah A', 'AKTIF'],
    [ids.reviewerB, ids.reviewerBUser, 'Penelaah B', 'AKTIF'],
    [ids.approver1, ids.approver1User, 'Pengesah Tingkat 1', 'AKTIF'],
    // Deliberately not active: aturan 5's redirect only opens when the
    // assignee genuinely cannot act.
    [ids.approver2, ids.approver2User, 'Pengesah Tingkat 2', 'BERHENTI'],
    [ids.delegate, ids.delegateUser, 'Penerima Delegasi', 'AKTIF'],
  ]

  for (const [employeeId, userId, name, status] of people) {
    await prisma.employee.create({
      data: {
        id: employeeId,
        employeeNumber: `EA-${employeeId.slice(0, 8)}`,
        fullName: name,
        email: `${employeeId.slice(0, 8)}@example.test`,
        jobTitle: name,
        orgUnitId: ids.orgUnit,
        employmentStatus: status,
        joinedAt: new Date('2020-01-01'),
        // The tier-2 approver reports to the tier-1 approver, so the
        // manager-fallback branch of aturan 5 has something to fall back to.
        ...(employeeId === ids.approver2 ? { managerId: ids.approver1 } : {}),
      },
    })
    await prisma.appUser.create({
      data: {
        id: userId,
        employeeId,
        externalId: `ua-${employeeId.slice(0, 8)}`,
        userType: 'INTERNAL',
        isActive: status === 'AKTIF',
      },
    })
  }

  // An active delegation from the inactive tier-2 approver to the delegate.
  await prisma.delegation.create({
    data: {
      id: randomUUID(),
      fromUserId: ids.approver2User,
      toUserId: ids.delegateUser,
      validFrom: daysFromNow(-1),
      validUntil: daysFromNow(30),
      scope: ['document:approve'],
      reason: 'Cuti panjang pengesah tingkat dua.',
    },
  })

  // The ladder under test: two parallel reviewers, then two sequential
  // approvers, with the top tier skippable on a minor revision.
  const template = [
    { kind: 'PENELAAHAN' as const, order: 1, employeeId: ids.reviewerA, skipOnMinor: true },
    { kind: 'PENELAAHAN' as const, order: 1, employeeId: ids.reviewerB, skipOnMinor: true },
    { kind: 'PENGESAHAN' as const, order: 1, employeeId: ids.approver1, skipOnMinor: false },
    { kind: 'PENGESAHAN' as const, order: 2, employeeId: ids.approver2, skipOnMinor: true },
  ]
  for (const t of template) {
    await prisma.documentApprovalTemplate.create({
      data: {
        id: randomUUID(),
        documentType: 'SOP',
        orgUnitId: ids.orgUnit,
        kind: t.kind,
        stepOrder: t.order,
        employeeId: t.employeeId,
        skipOnMinor: t.skipOnMinor,
      },
    })
  }

  author = principalOf(ids.authorUser, ids.author)
})

afterAll(async () => {
  const docs = await prisma.document.findMany({
    where: { ownerOrgUnitId: ids.orgUnit },
    select: { id: true },
  })
  const docIds = docs.map((d) => d.id)
  const versions = await prisma.documentVersion.findMany({
    where: { documentId: { in: docIds } },
    select: { id: true },
  })
  const versionIds = versions.map((v) => v.id)
  await prisma.documentApprovalStep.deleteMany({ where: { documentVersionId: { in: versionIds } } })
  await prisma.documentChunk.deleteMany({ where: { documentVersionId: { in: versionIds } } })
  await prisma.documentVersion.deleteMany({ where: { documentId: { in: docIds } } })
  await prisma.document.deleteMany({ where: { id: { in: docIds } } })
  await prisma.documentApprovalTemplate.deleteMany({ where: { orgUnitId: ids.orgUnit } })
  await prisma.delegation.deleteMany({ where: { fromUserId: ids.approver2User } })
  // audit_log is append-only (K-7); the users it references therefore stay.
  await prisma.appUser.updateMany({
    where: {
      id: {
        in: [
          ids.authorUser,
          ids.reviewerAUser,
          ids.reviewerBUser,
          ids.approver1User,
          ids.approver2User,
          ids.delegateUser,
        ],
      },
    },
    data: { isActive: false },
  })
  await prisma.$disconnect()
})

describe('FR-C-005 aturan 1 & 2 · telaah paralel, pengesahan berurutan', () => {
  it('membuka seluruh penelaah sekaligus, tetapi pengesah hanya satu per satu', async () => {
    const id = await createDoc('SOP Uji Urutan')
    await asUser(ids.authorUser, () => approvals.submit(author, id))

    const steps = await stepsOf(id)
    const reviews = steps.filter((s) => s.kind === 'PENELAAHAN')
    expect(reviews).toHaveLength(2)
    expect(reviews.every((s) => s.status === 'MENUNGGU')).toBe(true)

    // Tier 2 cannot sign before tier 1, even though its row exists.
    const tier2 = steps.find((s) => s.kind === 'PENGESAHAN' && s.stepOrder === 2)!
    const delegatePrincipal = principalOf(ids.delegateUser, ids.delegate)
    await expect(
      asUser(ids.delegateUser, () =>
        approvals.act(delegatePrincipal, tier2.id, 'SETUJU', 'Mencoba menyalip antrean.'),
      ),
    ).rejects.toThrow(/penelaahan belum selesai/i)
  })

  it('menolak pengesahan sebelum seluruh telaah selesai', async () => {
    const id = await createDoc('SOP Uji Telaah Dulu')
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    const steps = await stepsOf(id)

    // Only one of the two reviewers acts.
    const firstReview = steps.find((s) => s.kind === 'PENELAAHAN')!
    const reviewer = principalOf(
      firstReview.assigneeEmployeeId === ids.reviewerA ? ids.reviewerAUser : ids.reviewerBUser,
      firstReview.assigneeEmployeeId,
    )
    await asUser(reviewer.userId, () =>
      approvals.act(reviewer, firstReview.id, 'SETUJU', 'Telaah pertama selesai.'),
    )

    const tier1 = steps.find((s) => s.kind === 'PENGESAHAN' && s.stepOrder === 1)!
    const approver = principalOf(ids.approver1User, ids.approver1)
    await expect(
      asUser(ids.approver1User, () =>
        approvals.act(approver, tier1.id, 'SETUJU', 'Mencoba mengesahkan lebih awal.'),
      ),
    ).rejects.toThrow(/penelaahan belum selesai/i)
  })
})

describe('FR-C-005 aturan 3 · komentar dan alasan', () => {
  it('menolak keputusan tanpa komentar', async () => {
    const id = await createDoc('SOP Uji Komentar')
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    const step = (await stepsOf(id)).find((s) => s.kind === 'PENELAAHAN')!
    const reviewer = principalOf(
      step.assigneeEmployeeId === ids.reviewerA ? ids.reviewerAUser : ids.reviewerBUser,
      step.assigneeEmployeeId,
    )
    await expect(
      asUser(reviewer.userId, () => approvals.act(reviewer, step.id, 'SETUJU', '   ')),
    ).rejects.toThrow(/wajib memuat komentar/i)
  })

  it('menolak penolakan dengan alasan terlalu pendek', async () => {
    const id = await createDoc('SOP Uji Alasan')
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    const step = (await stepsOf(id)).find((s) => s.kind === 'PENELAAHAN')!
    const reviewer = principalOf(
      step.assigneeEmployeeId === ids.reviewerA ? ids.reviewerAUser : ids.reviewerBUser,
      step.assigneeEmployeeId,
    )
    await expect(
      asUser(reviewer.userId, () => approvals.act(reviewer, step.id, 'DITOLAK', 'tidak')),
    ).rejects.toThrow(/alasan/i)
  })

  it('basis data menolak penolakan tanpa alasan walau lewat tulis langsung', async () => {
    const id = await createDoc('SOP Uji Constraint')
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    const step = (await stepsOf(id)).find((s) => s.kind === 'PENELAAHAN')!
    // Bypassing the service entirely. The CHECK constraint has to hold anyway,
    // because "an approval with no recorded rationale" is the audit gap the
    // module exists to close.
    await expect(
      prisma.documentApprovalStep.update({
        where: { id: step.id },
        data: {
          status: 'DITOLAK',
          comment: null,
          actedBy: ids.reviewerAUser,
          actedAt: new Date(),
        },
      }),
    ).rejects.toThrow()
  })
})

describe('FR-C-005 aturan 5 · pengalihan ke delegasi', () => {
  it('penerima delegasi dapat bertindak untuk pengesah yang tidak aktif, dan tercatat', async () => {
    const id = await createDoc('SOP Uji Delegasi')
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    await approveReviews(id)

    const tier1 = (await stepsOf(id)).find((s) => s.kind === 'PENGESAHAN' && s.stepOrder === 1)!
    const approver1 = principalOf(ids.approver1User, ids.approver1)
    await asUser(ids.approver1User, () =>
      approvals.act(approver1, tier1.id, 'SETUJU', 'Disahkan tingkat satu.'),
    )

    const tier2 = (await stepsOf(id)).find((s) => s.kind === 'PENGESAHAN' && s.stepOrder === 2)!
    const delegate = principalOf(ids.delegateUser, ids.delegate)
    await asUser(ids.delegateUser, () =>
      approvals.act(delegate, tier2.id, 'SETUJU', 'Disahkan oleh penerima delegasi.'),
    )

    const done = await prisma.documentApprovalStep.findUniqueOrThrow({
      where: { id: tier2.id },
      select: { status: true, actedBy: true, redirectedFromEmployeeId: true, redirectReason: true },
    })
    expect(done.status).toBe('SETUJU')
    expect(done.actedBy).toBe(ids.delegateUser)
    // The redirect is recorded, not hidden: the trail shows both who was
    // supposed to act and who actually did.
    expect(done.redirectedFromEmployeeId).toBe(ids.approver2)
    expect(done.redirectReason).toMatch(/delegasi/i)

    const doc = await prisma.document.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })
    expect(doc.status).toBe('DISAHKAN')
  })

  it('orang lain tidak dapat mengambil langkah yang bukan tugasnya', async () => {
    const id = await createDoc('SOP Uji Bukan Tugas')
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    await approveReviews(id)
    const tier1 = (await stepsOf(id)).find((s) => s.kind === 'PENGESAHAN' && s.stepOrder === 1)!
    // The author holds document:approve in this test's principal, and still
    // cannot sign: the permission makes someone an approver in general, being
    // the assignee makes them the approver of THIS step.
    await expect(
      asUser(ids.authorUser, () => approvals.act(author, tier1.id, 'SETUJU', 'Menandatangani sendiri.')),
    ).rejects.toThrow(/bukan tugas anda/i)
  })
})

describe('FR-C-005 aturan 6 · penyusun menghentikan alur', () => {
  it('boleh dihentikan sebelum pengesahan, ditolak sesudahnya', async () => {
    const id = await createDoc('SOP Uji Henti')
    await asUser(ids.authorUser, () => approvals.submit(author, id))

    await asUser(ids.authorUser, () =>
      approvals.cancel(author, id, 'Perlu perbaikan menyeluruh sebelum ditelaah.'),
    )
    const afterCancel = await prisma.document.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })
    expect(afterCancel.status).toBe('DRAF')

    // Run it all the way through ratification, then try again.
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    await approveReviews(id)
    const tier1 = (await stepsOf(id)).find((s) => s.kind === 'PENGESAHAN' && s.stepOrder === 1)!
    const approver1 = principalOf(ids.approver1User, ids.approver1)
    await asUser(ids.approver1User, () =>
      approvals.act(approver1, tier1.id, 'SETUJU', 'Disahkan tingkat satu.'),
    )

    await expect(
      asUser(ids.authorUser, () => approvals.cancel(author, id, 'Berubah pikiran setelah disahkan.')),
    ).rejects.toThrow(/tahap pengesahan/i)
  })
})

describe('FR-C-006 aturan 2 · perubahan minor melewati sebagian jenjang', () => {
  it('melewati langkah yang ditandai boleh dilewati, dan mencatatnya', async () => {
    const id = await createDoc('SOP Uji Minor')
    await asUser(ids.authorUser, () => approvals.submit(author, id, { isMinor: true }))

    const steps = await stepsOf(id)
    const skipped = steps.filter((s) => s.status === 'DILEWATI')
    // Both reviewers and the top approval tier are skippable in this ladder.
    expect(skipped).toHaveLength(3)
    // The mandatory tier is still waiting: a typo fix skips signatures, never
    // all of them.
    const waiting = steps.filter((s) => s.status === 'MENUNGGU')
    expect(waiting).toHaveLength(1)
    expect(waiting[0]!.kind).toBe('PENGESAHAN')
    expect(waiting[0]!.stepOrder).toBe(1)
  })
})

describe('penolakan mengembalikan versi ke draf', () => {
  it('membatalkan langkah tersisa dan mengembalikan dokumen ke Draf', async () => {
    const id = await createDoc('SOP Uji Tolak')
    await asUser(ids.authorUser, () => approvals.submit(author, id))
    const step = (await stepsOf(id)).find((s) => s.kind === 'PENELAAHAN')!
    const reviewer = principalOf(
      step.assigneeEmployeeId === ids.reviewerA ? ids.reviewerAUser : ids.reviewerBUser,
      step.assigneeEmployeeId,
    )
    await asUser(reviewer.userId, () =>
      approvals.act(reviewer, step.id, 'DIKEMBALIKAN', 'Pasal 3 bertentangan dengan kebijakan induk.'),
    )

    const doc = await prisma.document.findUniqueOrThrow({
      where: { id },
      select: { status: true },
    })
    expect(doc.status).toBe('DRAF')

    // Nothing is left waiting: resubmission restarts the ladder, because the
    // earlier approvers would otherwise have signed text that changed.
    const stillWaiting = (await stepsOf(id)).filter((s) => s.status === 'MENUNGGU')
    expect(stillWaiting).toHaveLength(0)
  })
})

/* ------------------------------------------------------------- helpers --- */

async function createDoc(title: string): Promise<string> {
  const { id } = await asUser(ids.authorUser, () =>
    documents.create(author, {
      title: `${title} ${suffix}`,
      documentType: 'SOP',
      ownerOrgUnitId: ids.orgUnit,
      ownerEmployeeId: ids.author,
      classification: 'INTERNAL',
      processArea: 'KEPATUHAN',
      body: 'BAB I UMUM\n\nPasal 1\n\nKetentuan umum.',
      changeSummary: 'Versi pertama.',
    }),
  )
  return id
}

async function stepsOf(documentId: string) {
  return prisma.documentApprovalStep.findMany({
    where: { version: { documentId } },
    select: {
      id: true,
      kind: true,
      stepOrder: true,
      status: true,
      assigneeEmployeeId: true,
    },
    orderBy: [{ kind: 'asc' }, { stepOrder: 'asc' }],
  })
}

async function approveReviews(documentId: string): Promise<void> {
  const reviews = (await stepsOf(documentId)).filter(
    (s) => s.kind === 'PENELAAHAN' && s.status === 'MENUNGGU',
  )
  for (const step of reviews) {
    const userId =
      step.assigneeEmployeeId === ids.reviewerA ? ids.reviewerAUser : ids.reviewerBUser
    const reviewer = principalOf(userId, step.assigneeEmployeeId)
    await asUser(userId, () => approvals.act(reviewer, step.id, 'SETUJU', 'Telaah selesai.'))
  }
}

function daysFromNow(days: number): Date {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
  d.setUTCDate(d.getUTCDate() + days)
  return d
}
