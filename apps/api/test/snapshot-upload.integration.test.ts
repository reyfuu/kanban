import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { SnapshotUploadService } from '../src/modules/access/snapshot-upload.service.js'
import { SnapshotService } from '../src/modules/access/snapshot.service.js'
import { SnapshotStagingStore } from '../src/modules/access/snapshot-staging.store.js'
import { RevocationService } from '../src/modules/access/revocation.service.js'

/**
 * FR-B-004, FR-B-005, FR-B-006 and the K-1 loop they close, against the real
 * database and the real Redis.
 *
 * The unit tests cover the row rules. What this file covers is everything a
 * unit test cannot: that a validated upload becomes an immutable snapshot, that
 * the mapping cascade attaches the right people to the right accounts, and --
 * the reason this work exists -- that a pending revocation ticket closes
 * because a fresh snapshot proves the access is gone, and stays open when it
 * proves the opposite.
 */
const prisma = new PrismaService()
const staging = new SnapshotStagingStore()
const uow = new UnitOfWork(prisma)
const uploads = new SnapshotUploadService(prisma, uow, staging)
const snapshots = new SnapshotService(prisma)
const revocations = new RevocationService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  employee: randomUUID(),
  user: randomUUID(),
  application: randomUUID(),
  entitlementKept: randomUUID(),
  entitlementRevoked: randomUUID(),
  campaign: randomUUID(),
  item: randomUUID(),
  decision: randomUUID(),
  ticket: randomUUID(),
}

const suffix = ids.application.slice(0, 8)
const employeeNumber = `E-${suffix}`
const accountName = `uji.${suffix}`
const accountId = `u-${suffix}`

let principal: Principal
const createdSnapshots: string[] = []

/** Runs `fn` as the fixture user, which is what the audit recorder requires. */
async function asUser<T>(fn: () => Promise<T>): Promise<T> {
  return runWithRequestContext(
    {
      requestId: randomUUID(),
      actorId: ids.user,
      actorRoles: ['SEC_OFFICER'],
      // Null rather than a random uuid: audit_log.session_id is a foreign key
      // to a real session, and fabricating one would test the fixture, not the
      // code.
      sessionId: null,
      ipAddress: '127.0.0.1',
    },
    fn,
  )
}

function file(body: string) {
  return { originalname: 'akses.csv', size: Buffer.byteLength(body), buffer: Buffer.from(body) }
}

const HEADER = 'account_id,account_name,entitlement_code,account_status,employee_number'

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OU-${suffix}`, name: 'Unit Uji Unggahan' },
  })
  await prisma.employee.create({
    data: {
      id: ids.employee,
      employeeNumber,
      fullName: 'Penguji Unggahan',
      email: `${suffix}@contoh.internal`,
      jobTitle: 'Staf',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2026-01-01'),
    },
  })
  await prisma.appUser.create({
    data: { id: ids.user, employeeId: ids.employee, externalId: accountName, userType: 'INTERNAL' },
  })
  await prisma.application.create({
    data: {
      id: ids.application,
      code: `UJI-${suffix}`,
      name: 'Aplikasi Uji Unggahan',
      ownerEmployeeId: ids.employee,
      criticality: 'SEDANG',
      hostingType: 'ON_PREMISE',
      reviewFrequency: 'TAHUNAN',
    },
  })
  for (const [id, code] of [
    [ids.entitlementKept, 'UJI_KEPT'],
    [ids.entitlementRevoked, 'UJI_REVOKED'],
  ] as const) {
    await prisma.entitlementCatalog.create({
      data: {
        id,
        applicationId: ids.application,
        technicalCode: code,
        displayName: code,
        entitlementType: 'PERAN',
        riskLevel: 'SEDANG',
      },
    })
  }

  principal = {
    userId: ids.user,
    externalId: accountName,
    employeeId: ids.employee,
    fullName: 'Penguji Unggahan',
    jobTitle: null,
    roles: ['SEC_OFFICER'],
    permissions: ['snapshot:upload', 'application:read'],
    scopes: {},
    delegatedFrom: [],
  }
})

afterAll(async () => {
  await prisma.revocationTicket.deleteMany({ where: { applicationId: ids.application } })
  await prisma.reviewDecision.deleteMany({ where: { reviewItemId: ids.item } })
  await prisma.reviewItem.deleteMany({ where: { campaignId: ids.campaign } })
  await prisma.reviewCampaign.deleteMany({ where: { id: ids.campaign } })
  for (const id of createdSnapshots) {
    await prisma.$executeRaw`DELETE FROM public.snapshot_line WHERE snapshot_id = ${id}::uuid`
  }
  await prisma.accessSnapshot.deleteMany({ where: { applicationId: ids.application } })
  await prisma.entitlementCatalog.deleteMany({ where: { applicationId: ids.application } })
  await prisma.application.deleteMany({ where: { id: ids.application } })
  // Identity rows last and allowed to fail: audit_log.actor_id refuses the
  // delete once this run has recorded anything, and that refusal is K-7
  // working. The application row above is the one that must go, because that
  // is what would otherwise appear in the product's own registry.
  try {
    await prisma.appUser.deleteMany({ where: { id: ids.user } })
    await prisma.employee.deleteMany({ where: { id: ids.employee } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the audit trail; it stays, permanently and correctly.
  }

  await staging.onModuleDestroy()
  await prisma.$disconnect()
})

/**
 * Validates and commits in one step; returns the new snapshot id.
 *
 * Confirms ROW_COUNT_DROP by default. Most fixtures here are two or three rows
 * and shrink between cases, so without this every test would be about aturan 6
 * whether or not that is what it means to check. The refusal itself is tested
 * on its own, deliberately unconfirmed, below.
 */
async function ingest(body: string): Promise<string> {
  return asUser(async () => {
    const preview = await uploads.validate(principal, ids.application, file(body))
    const result = await uploads.commit(principal, {
      validationId: preview.validationId,
      skipInvalidRows: true,
      confirmWarnings: ['ROW_COUNT_DROP'],
    })
    createdSnapshots.push(result.snapshotId)
    return result.snapshotId
  })
}

describe('FR-B-004 aturan 5 · unggahan menjadi snapshot bertanggal bersumber manual', () => {
  it('mencatat sumber, pengunggah, dan sidik jari isi', async () => {
    const id = await ingest(
      [
        HEADER,
        `${accountId},${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `${accountId},${accountName},UJI_REVOKED,AKTIF,${employeeNumber}`,
      ].join('\n'),
    )

    const snapshot = await prisma.accessSnapshot.findUniqueOrThrow({ where: { id } })
    expect(snapshot.source).toBe('MANUAL')
    expect(snapshot.capturedBy).toBe(ids.user)
    expect(snapshot.status).toBe('SELESAI')
    expect(snapshot.entitlementCount).toBe(2)
    expect(snapshot.identityCount).toBe(1)
    expect(snapshot.contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('menulis jejak audit dalam transaksi yang sama (aturan kode #2)', async () => {
    const id = createdSnapshots[0]!
    const rows = await prisma.$queryRaw<{ action: string; actor_id: string }[]>`
      SELECT action, actor_id::text FROM public.audit_log WHERE object_id = ${id}::uuid
    `
    expect(rows).toHaveLength(1)
    expect(rows[0]?.action).toBe('UNGGAH_SNAPSHOT')
    expect(rows[0]?.actor_id).toBe(ids.user)
  })

  it('sidik jari isi tidak berubah ketika urutan baris berubah', async () => {
    const first = await prisma.accessSnapshot.findUniqueOrThrow({
      where: { id: createdSnapshots[0]! },
    })
    const reordered = await ingest(
      [
        HEADER,
        `${accountId},${accountName},UJI_REVOKED,AKTIF,${employeeNumber}`,
        `${accountId},${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
      ].join('\n'),
    )
    const second = await prisma.accessSnapshot.findUniqueOrThrow({ where: { id: reordered } })
    // Otherwise every re-export of unchanged access looks like a change, and
    // the fingerprint answers no question worth asking.
    expect(second.contentHash).toBe(first.contentHash)
  })
})

describe('FR-B-006 · pemetaan akun ke karyawan', () => {
  it('aturan 1 · memetakan lewat nomor induk karyawan', async () => {
    const lines = await prisma.snapshotLine.findMany({
      where: { snapshotId: createdSnapshots[0]! },
      select: { employeeId: true },
    })
    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.employeeId === ids.employee)).toBe(true)
  })

  it('aturan 1 · memetakan lewat surel ketika nomor induk tidak disertakan', async () => {
    const id = await ingest(
      `account_id,account_name,entitlement_code,account_status,email\n` +
        `${accountId},lain,UJI_KEPT,AKTIF,${suffix}@contoh.internal`,
    )
    const line = await prisma.snapshotLine.findFirstOrThrow({ where: { snapshotId: id } })
    expect(line.employeeId).toBe(ids.employee)
  })

  it('aturan 1 · memetakan lewat nama akun yang sama dengan akun direktori', async () => {
    const id = await ingest(`${HEADER}\n${accountId},${accountName},UJI_KEPT,AKTIF,`)
    const line = await prisma.snapshotLine.findFirstOrThrow({ where: { snapshotId: id } })
    expect(line.employeeId).toBe(ids.employee)
  })

  it('aturan 4 · akun yang tidak dapat dipetakan ditandai Tanpa Pemilik', async () => {
    const id = await ingest(`${HEADER}\nsvc-batch,svc-batch,UJI_KEPT,AKTIF,`)
    const line = await prisma.snapshotLine.findFirstOrThrow({ where: { snapshotId: id } })
    // Null, not a guess. A similarity match would attach one person's access to
    // another person's review with nothing to show it was a guess.
    expect(line.employeeId).toBeNull()

    const detail = await snapshots.findOne(principal, id)
    expect(detail.unowned_account_count).toBe(1)
  })
})

describe('FR-B-004 aturan 6 · penurunan jumlah baris menuntut konfirmasi', () => {
  it('menolak penyimpanan ketika peringatan tidak dikonfirmasi', async () => {
    // The previous snapshot holds one row, so two rows is a rise, not a drop --
    // build a large snapshot first so the next one can fall past the threshold.
    await ingest(
      [
        HEADER,
        `a1,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a2,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a3,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a4,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a5,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a6,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a7,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a8,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a9,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `a10,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
      ].join('\n'),
    )

    const where = { applicationId: ids.application }
    const before = await prisma.accessSnapshot.count({ where })

    await asUser(async () => {
      const truncated = `${HEADER}\na1,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`
      const preview = await uploads.validate(principal, ids.application, file(truncated))

      expect(preview.warnings.map((w) => w.code)).toContain('ROW_COUNT_DROP')
      expect(preview.warnings[0]?.requiresConfirmation).toBe(true)
      expect(preview.warnings[0]?.message).toContain('90%')

      await expect(
        uploads.commit(principal, {
          validationId: preview.validationId,
          skipInvalidRows: true,
          confirmWarnings: [],
        }),
      ).rejects.toThrow(/dikonfirmasi/)

      // Confirming some other code is not confirming this one.
      await expect(
        uploads.commit(principal, {
          validationId: preview.validationId,
          skipInvalidRows: true,
          confirmWarnings: ['SESUATU_YANG_LAIN'],
        }),
      ).rejects.toThrow(/ROW_COUNT_DROP/)

      // And neither refusal wrote anything: an incomplete export must not land
      // on the strength of a request that failed.
      expect(await prisma.accessSnapshot.count({ where })).toBe(before)
    })
  })

  it('menyimpan setelah dikonfirmasi, dan mencatat alasannya di jejak audit', async () => {
    const id = await asUser(async () => {
      const truncated = `${HEADER}\na1,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`
      const preview = await uploads.validate(principal, ids.application, file(truncated))
      const result = await uploads.commit(principal, {
        validationId: preview.validationId,
        skipInvalidRows: true,
        confirmWarnings: ['ROW_COUNT_DROP'],
        confirmationNote: 'Penurunan disebabkan penghapusan akun tidak aktif sesuai tiket TI-2026-4471.',
      })
      createdSnapshots.push(result.snapshotId)
      return result.snapshotId
    })

    const rows = await prisma.$queryRaw<{ after_value: unknown }[]>`
      SELECT after_value FROM public.audit_log WHERE object_id = ${id}::uuid
    `
    // The whole value of aturan 6 is that "who waved through a 90% drop, and
    // why" has an answer afterwards.
    const after = rows[0]?.after_value as { confirmed_warnings: string[]; confirmation_note: string }
    expect(after.confirmed_warnings).toEqual(['ROW_COUNT_DROP'])
    expect(after.confirmation_note).toContain('TI-2026-4471')
  })
})

describe('FR-B-020 · K-1 — snapshot baru memverifikasi tiket pencabutan', () => {
  it('menutup tiket ketika hak akses benar-benar hilang, dan menandai gagal ketika masih ada', async () => {
    const snapshotWithBoth = await ingest(
      [
        HEADER,
        `${accountId},${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `${accountId},${accountName},UJI_REVOKED,AKTIF,${employeeNumber}`,
      ].join('\n')
    )

    // A ticket cannot exist without the decision that produced it -- the
    // schema says so, and that is the point of K-1: revocation is downstream
    // of a recorded human decision, never a free-standing row.
    const line = await prisma.snapshotLine.findFirstOrThrow({
      where: { snapshotId: snapshotWithBoth, entitlementId: ids.entitlementRevoked },
    })
    await prisma.reviewCampaign.create({
      data: {
        id: ids.campaign,
        code: `UJI-${suffix}`,
        name: 'Kampanye Uji Unggahan',
        campaignType: 'PERIODIK',
        startDate: new Date('2026-08-01'),
        dueDate: new Date('2026-12-31'),
        reviewerRule: { code: 'RA-02' },
        fallbackReviewerId: ids.user,
        status: 'BERJALAN',
      },
    })
    await prisma.reviewItem.create({
      data: {
        id: ids.item,
        campaignId: ids.campaign,
        snapshotLineId: line.id,
        reviewerId: ids.user,
        status: 'DIPUTUSKAN',
      },
    })
    await prisma.reviewDecision.create({
      data: {
        id: ids.decision,
        reviewItemId: ids.item,
        decision: 'CABUT',
        reason: 'Akses tidak lagi diperlukan.',
        decidedBy: ids.user,
      },
    })
    await prisma.revocationTicket.create({
      data: {
        id: ids.ticket,
        decisionId: ids.decision,
        ticketNo: `UJI-${suffix}`,
        applicationId: ids.application,
        accountId,
        entitlementId: ids.entitlementRevoked,
        actionType: 'CABUT',
        status: 'MENUNGGU_VERIFIKASI',
        assigneeId: ids.employee,
        slaDueDate: new Date('2026-12-31'),
      },
    })

    // The access is still there, so the ticket must NOT close.
    const stillPresent = await asUser(() => revocations.verifyAgainstSnapshot(snapshotWithBoth))
    expect(stillPresent).toMatchObject({ checked: 1, closed: 0, failed: 1 })
    expect((await prisma.revocationTicket.findUniqueOrThrow({ where: { id: ids.ticket } })).status).toBe(
      'GAGAL_DIVERIFIKASI',
    )

    // Back to waiting, then a snapshot that genuinely lacks the entitlement.
    await prisma.revocationTicket.update({
      where: { id: ids.ticket },
      data: { status: 'MENUNGGU_VERIFIKASI' },
    })
    const snapshotWithoutIt = await ingest(
      `${HEADER}\n${accountId},${accountName},UJI_KEPT,AKTIF,${employeeNumber}`
    )

    const gone = await asUser(() => revocations.verifyAgainstSnapshot(snapshotWithoutIt))
    expect(gone).toMatchObject({ checked: 1, closed: 1, failed: 0 })

    const closed = await prisma.revocationTicket.findUniqueOrThrow({ where: { id: ids.ticket } })
    expect(closed.status).toBe('TERVERIFIKASI_TERTUTUP')
    // The evidence is the snapshot itself, named on the ticket -- K-1's whole
    // point is that closure cites data rather than an assertion.
    expect(closed.verifiedBySnapshotId).toBe(snapshotWithoutIt)
  })
})

describe('FR-B-005 aturan 4 · perbandingan antar-snapshot', () => {
  it('melaporkan hak akses yang bertambah, berkurang, dan berubah statusnya', async () => {
    const before = await ingest(
      [
        HEADER,
        `${accountId},${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
        `${accountId},${accountName},UJI_REVOKED,AKTIF,${employeeNumber}`,
      ].join('\n')
    )
    const after = await ingest(
      [
        HEADER,
        `${accountId},${accountName},UJI_KEPT,NONAKTIF,${employeeNumber}`,
        `lain-01,${accountName},UJI_KEPT,AKTIF,${employeeNumber}`,
      ].join('\n')
    )

    const diff = await snapshots.compare(principal, before, after)
    expect(diff.summary).toEqual({ added: 1, removed: 1, changed: 1 })
    expect(diff.changes.find((c) => c.type === 'DIUBAH')).toMatchObject({
      account_id: accountId,
      from_status: 'AKTIF',
      to_status: 'NONAKTIF',
    })
    expect(diff.changes.find((c) => c.type === 'DIHAPUS')?.entitlement.code).toBe('UJI_REVOKED')
    expect(diff.changes.find((c) => c.type === 'DITAMBAH')?.account_id).toBe('lain-01')
  })
})

describe('FR-B-005 aturan 2 · snapshot tidak dapat disunting', () => {
  it('tidak ada jalur tulis selain penambahan snapshot baru', () => {
    // Stated as a shape check rather than a comment: SnapshotService is the
    // read path and must never grow an update or delete method, because
    // correction is defined as capturing again.
    const methods = Object.getOwnPropertyNames(SnapshotService.prototype)
    expect(methods.filter((m) => /update|delete|patch|edit/i.test(m))).toEqual([])
  })
})

describe('CLAUDE.md aturan 1 dan 3 · penyaringan cakupan di lapisan repositori', () => {
  it('mengembalikan 404, bukan 403, untuk snapshot di luar cakupan', async () => {
    const narrowed: Principal = { ...principal, scopes: { applications: [randomUUID()] } }
    await expect(snapshots.findOne(narrowed, createdSnapshots[0]!)).rejects.toThrow(
      /tidak ditemukan/,
    )
  })

  it('menolak mengunggah ke aplikasi di luar cakupan', async () => {
    const narrowed: Principal = { ...principal, scopes: { applications: [randomUUID()] } }
    await expect(
      asUser(() =>
        uploads.validate(narrowed, ids.application, file(`${HEADER}\na,b,UJI_KEPT,AKTIF,`)),
      ),
    ).rejects.toThrow(/tidak ditemukan/)
  })
})
