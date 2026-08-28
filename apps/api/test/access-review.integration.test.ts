import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'

/**
 * Modul B critical controls, against the real database as the real runtime role.
 *
 * These test what the DATABASE refuses, not what the service refuses. The
 * service-level halves are covered by review-rules.test.ts and by the HTTP
 * probes; this file exists because a control that lives only in application code
 * is one forgotten call path away from being absent, and the point of putting
 * K-1, K-2 and K-3 in constraints was that they hold even when the application
 * is wrong.
 *
 * Each test tries to DO the forbidden thing and expects to be stopped. A test
 * that merely reads the constraint definition would pass against a constraint
 * that does not work.
 */
const prisma = new PrismaService()

const ids = {
  orgUnit: randomUUID(),
  employee: randomUUID(),
  user: randomUUID(),
  application: randomUUID(),
  entitlement: randomUUID(),
  snapshot: randomUUID(),
  line: randomUUID(),
  campaign: randomUUID(),
  item: randomUUID(),
}

const capturedAt = new Date('2026-06-15T03:00:00.000Z')

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OU-${ids.orgUnit.slice(0, 8)}`, name: 'Unit Uji Modul B' },
  })
  await prisma.employee.create({
    data: {
      id: ids.employee,
      employeeNumber: `E-${ids.employee.slice(0, 8)}`,
      fullName: 'Penguji Modul B',
      email: `${ids.employee.slice(0, 8)}@contoh.internal`,
      jobTitle: 'Staf',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2026-01-01'),
    },
  })
  await prisma.appUser.create({
    data: {
      id: ids.user,
      employeeId: ids.employee,
      externalId: `uji.${ids.user.slice(0, 8)}`,
      userType: 'INTERNAL',
    },
  })
  await prisma.application.create({
    data: {
      id: ids.application,
      code: `APP-${ids.application.slice(0, 8)}`,
      name: 'Aplikasi Uji',
      ownerEmployeeId: ids.employee,
      criticality: 'SEDANG',
      hostingType: 'ON_PREMISE',
      reviewFrequency: 'TAHUNAN',
    },
  })
  await prisma.entitlementCatalog.create({
    data: {
      id: ids.entitlement,
      applicationId: ids.application,
      technicalCode: 'UJI_ISTIMEWA',
      displayName: 'Hak Akses Uji',
      businessDescription: 'Dipakai hanya oleh berkas uji ini.',
      entitlementType: 'PERAN',
      riskLevel: 'KRITIS',
      isPrivileged: true,
    },
  })
  await prisma.accessSnapshot.create({
    data: {
      id: ids.snapshot,
      applicationId: ids.application,
      capturedAt,
      source: 'MANUAL',
      contentHash: 'a'.repeat(64),
      status: 'SELESAI',
    },
  })
  await prisma.snapshotLine.create({
    data: {
      id: ids.line,
      snapshotId: ids.snapshot,
      capturedAt,
      accountId: 'u-uji',
      entitlementId: ids.entitlement,
      employeeId: ids.employee,
      accountStatus: 'AKTIF',
    },
  })
  await prisma.reviewCampaign.create({
    data: {
      id: ids.campaign,
      code: `UJI-${ids.campaign.slice(0, 8)}`,
      name: 'Kampanye Uji',
      campaignType: 'AD_HOC',
      startDate: new Date('2026-06-01'),
      dueDate: new Date('2026-06-30'),
      reviewerRule: { type: 'APP_OWNER' },
      fallbackReviewerId: ids.user,
      status: 'BERJALAN',
    },
  })
  await prisma.reviewItem.create({
    data: {
      id: ids.item,
      campaignId: ids.campaign,
      snapshotLineId: ids.line,
      reviewerId: ids.user,
    },
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('K-2 · FR-B-012 aturan 1 — tidak ada keputusan bawaan', () => {
  it('TC-FN-B-043 · kolom decision tidak memiliki DEFAULT di basis data', async () => {
    const rows = await prisma.$queryRaw<{ column_default: string | null }[]>`
      SELECT column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'review_decision' AND column_name = 'decision'
    `
    expect(rows).toHaveLength(1)
    // If this ever becomes non-null, an unfilled decision starts meaning
    // something, and the campaign stops being a control (FR-B-012 rationale).
    expect(rows[0]?.column_default).toBeNull()
  })

  it('TC-FN-B-044 · INSERT tanpa decision ditolak, bukan diisi diam-diam', async () => {
    await expect(
      prisma.$executeRaw`
        INSERT INTO public.review_decision (id, review_item_id, decided_by)
        VALUES (${randomUUID()}::uuid, ${ids.item}::uuid, ${ids.user}::uuid)
      `,
    ).rejects.toThrow()
  })

  it('TC-FN-B-045 · item tanpa keputusan tetap BELUM_DIPUTUSKAN', async () => {
    const item = await prisma.reviewItem.findUniqueOrThrow({
      where: { id: ids.item },
      include: { decision: true },
    })
    expect(item.decision).toBeNull()
    expect(item.status).toBe('BELUM_DIPUTUSKAN')
  })
})

describe('K-3 · FR-B-012 aturan 2 — bentuk alasan ditegakkan basis data', () => {
  async function insertDecision(decision: string, reason: string | null): Promise<void> {
    await prisma.$executeRawUnsafe(
      `INSERT INTO public.review_decision (id, review_item_id, decision, reason, decided_by)
       VALUES ($1::uuid, $2::uuid, $3::review_decision_type, $4, $5::uuid)`,
      randomUUID(),
      ids.item,
      decision,
      reason,
      ids.user,
    )
  }

  it('TC-FN-B-046 · CABUT tanpa alasan ditolak oleh CHECK', async () => {
    await expect(insertDecision('CABUT', null)).rejects.toThrow()
  })

  it('TC-FN-B-047 · alasan di bawah 10 karakter ditolak', async () => {
    await expect(insertDecision('CABUT', 'masih')).rejects.toThrow()
  })

  it('TC-FN-B-048 · alasan berupa pengulangan satu karakter ditolak', async () => {
    await expect(insertDecision('CABUT', 'aaaaaaaaaaaaaaa')).rejects.toThrow()
  })

  it('TC-FN-B-049 · alasan yang sah diterima, lalu dibersihkan', async () => {
    await insertDecision('CABUT', 'Yang bersangkutan pindah unit per 1 Juni 2026.')
    const stored = await prisma.reviewDecision.findUnique({ where: { reviewItemId: ids.item } })
    expect(stored?.decision).toBe('CABUT')
    // K-4: every row states explicitly whether it came from a bulk action.
    expect(stored?.bulkApplied).toBe(false)
    await prisma.reviewDecision.deleteMany({ where: { reviewItemId: ids.item } })
  })
})

describe('K-1 · FR-B-019 — tiket tidak dapat ditutup tanpa bukti snapshot', () => {
  async function makeTicket(): Promise<{ ticketId: string; decisionId: string }> {
    const decisionId = randomUUID()
    await prisma.reviewDecision.create({
      data: {
        id: decisionId,
        reviewItemId: ids.item,
        decision: 'CABUT',
        reason: 'Akses tidak lagi diperlukan setelah mutasi unit.',
        decidedBy: ids.user,
      },
    })
    const ticketId = randomUUID()
    await prisma.revocationTicket.create({
      data: {
        id: ticketId,
        decisionId,
        ticketNo: `TKT-UJI-${ticketId.slice(0, 8)}`,
        applicationId: ids.application,
        entitlementId: ids.entitlement,
        accountId: 'u-uji',
        actionType: 'CABUT',
        assigneeId: ids.employee,
        slaDueDate: new Date('2026-06-20'),
        status: 'MENUNGGU_VERIFIKASI',
      },
    })
    return { ticketId, decisionId }
  }

  it('TC-FN-B-071 · TERVERIFIKASI_TERTUTUP tanpa snapshot ditolak oleh CHECK', async () => {
    const { ticketId, decisionId } = await makeTicket()

    // The direct database attempt: even holding UPDATE on the table, and even
    // bypassing every line of application code, the status cannot be set
    // without naming the snapshot that proved the access is gone.
    await expect(
      prisma.revocationTicket.update({
        where: { id: ticketId },
        data: { status: 'TERVERIFIKASI_TERTUTUP' },
      }),
    ).rejects.toThrow()

    const after = await prisma.revocationTicket.findUniqueOrThrow({ where: { id: ticketId } })
    expect(after.status).toBe('MENUNGGU_VERIFIKASI')

    await prisma.revocationTicket.delete({ where: { id: ticketId } })
    await prisma.reviewDecision.delete({ where: { id: decisionId } })
  })

  it('TC-FN-B-072 · penutupan diterima hanya bersama id snapshot yang memverifikasi', async () => {
    const { ticketId, decisionId } = await makeTicket()

    await prisma.revocationTicket.update({
      where: { id: ticketId },
      data: { status: 'TERVERIFIKASI_TERTUTUP', verifiedBySnapshotId: ids.snapshot },
    })

    const after = await prisma.revocationTicket.findUniqueOrThrow({ where: { id: ticketId } })
    expect(after.status).toBe('TERVERIFIKASI_TERTUTUP')
    expect(after.verifiedBySnapshotId).toBe(ids.snapshot)

    await prisma.revocationTicket.delete({ where: { id: ticketId } })
    await prisma.reviewDecision.delete({ where: { id: decisionId } })
  })
})

describe('K-9 · FR-B-015 aturan 3 — sidik jari sign-off', () => {
  it('TC-FN-B-061 · sidik jari yang bukan SHA-256 heksadesimal ditolak', async () => {
    await expect(
      prisma.campaignSignoff.create({
        data: {
          id: randomUUID(),
          campaignId: ids.campaign,
          signedBy: ids.user,
          ipAddress: '10.0.0.1',
          decisionCounts: { PERTAHANKAN: 1 },
          contentFingerprint: 'bukan-sidik-jari',
        },
      }),
    ).rejects.toThrow()
  })
})

describe('ADR-07 · integritas referensial snapshot_line ada di lapisan aplikasi', () => {
  it('basis data MENERIMA review_item yang menunjuk baris snapshot yang tidak ada', async () => {
    // Not a bug being asserted -- a consequence being pinned down. snapshot_line
    // is partitioned on captured_at and its key is (id, captured_at), so no
    // single-column foreign key is possible (migration Sec 7). This test exists
    // so that the day someone adds the constraint, it fails and tells them the
    // repository check in ReviewItemRepository.assertSnapshotLineExists is now
    // redundant -- rather than the check silently outliving its reason.
    const orphanId = randomUUID()
    await prisma.reviewItem.create({
      data: {
        id: orphanId,
        campaignId: ids.campaign,
        snapshotLineId: randomUUID(),
        reviewerId: ids.user,
      },
    })
    const stored = await prisma.reviewItem.findUnique({ where: { id: orphanId } })
    expect(stored).not.toBeNull()
    await prisma.reviewItem.delete({ where: { id: orphanId } })
  })
})
