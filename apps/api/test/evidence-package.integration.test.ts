import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PrismaService } from '../src/modules/shared/prisma/prisma.service.js'
import { UnitOfWork } from '../src/modules/shared/audit/unit-of-work.js'
import { runWithRequestContext } from '../src/modules/shared/request-context/request-context.js'
import type { Principal } from '../src/modules/shared/authz/principal.js'
import { EvidencePackageService } from '../src/modules/access/evidence-package.service.js'
import { CampaignService } from '../src/modules/access/campaign.service.js'

/**
 * FR-B-022 / FR-B-023 · the campaign evidence package and its cross-module
 * bridge, against the real database.
 *
 * The flow is built end to end: a campaign with one decided item is signed off,
 * a pack is generated, and the test then checks the things a pure test could
 * not -- that generation closed the campaign (FR-B-010), that the pack became a
 * system-generated Modul A evidence entity auto-linked to a periodic control
 * (FR-B-023), that its fingerprint is stable across reads (FR-B-022 rule 3),
 * that the revocation section reports rather than gates, and that a second
 * generation is refused. Every write goes through UnitOfWork, so K-7 is
 * exercised too.
 */
const prisma = new PrismaService()
const uow = new UnitOfWork(prisma)
const packs = new EvidencePackageService(prisma, uow)
const campaigns = new CampaignService(prisma, uow)

const ids = {
  orgUnit: randomUUID(),
  employee: randomUUID(),
  user: randomUUID(),
  controlOwner: randomUUID(),
  application: randomUUID(),
  entitlement: randomUUID(),
  snapshot: randomUUID(),
  line: randomUUID(),
  campaign: randomUUID(),
  item: randomUUID(),
  decision: randomUUID(),
  control: randomUUID(),
}
const suffix = ids.campaign.slice(0, 8)
const capturedAt = new Date('2026-06-15T03:00:00.000Z')

let principal: Principal

function asUser<T>(fn: () => Promise<T>): Promise<T> {
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

beforeAll(async () => {
  await prisma.$connect()

  await prisma.organizationUnit.create({
    data: { id: ids.orgUnit, code: `OUP-${suffix}`, name: 'Unit Uji Paket Bukti' },
  })
  await prisma.employee.create({
    data: {
      id: ids.employee,
      employeeNumber: `EP-${suffix}`,
      fullName: 'Penguji Paket Bukti',
      email: `${suffix}@contoh.internal`,
      jobTitle: 'Staf',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2026-01-01'),
    },
  })
  await prisma.employee.create({
    data: {
      id: ids.controlOwner,
      employeeNumber: `EPO-${suffix}`,
      fullName: 'Pemilik Kontrol Uji',
      email: `owner-${suffix}@contoh.internal`,
      jobTitle: 'Manajer',
      orgUnitId: ids.orgUnit,
      employmentStatus: 'AKTIF',
      joinedAt: new Date('2026-01-01'),
    },
  })
  await prisma.appUser.create({
    data: {
      id: ids.user,
      employeeId: ids.employee,
      externalId: `uji.paket.${suffix}`,
      userType: 'INTERNAL',
    },
  })
  await prisma.application.create({
    data: {
      id: ids.application,
      code: `APP-${suffix}`,
      name: 'Aplikasi Uji Paket',
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
      technicalCode: 'UJI_PAKET',
      displayName: 'Hak Akses Uji Paket',
      businessDescription: 'Dipakai hanya oleh berkas uji ini.',
      entitlementType: 'PERAN',
      riskLevel: 'SEDANG',
      isPrivileged: false,
    },
  })
  await prisma.accessSnapshot.create({
    data: {
      id: ids.snapshot,
      applicationId: ids.application,
      capturedAt,
      source: 'MANUAL',
      contentHash: 'b'.repeat(64),
      status: 'SELESAI',
    },
  })
  await prisma.snapshotLine.create({
    data: {
      id: ids.line,
      snapshotId: ids.snapshot,
      capturedAt,
      accountId: 'u-paket',
      entitlementId: ids.entitlement,
      employeeId: ids.employee,
      accountStatus: 'AKTIF',
    },
  })
  // A periodic access-review control: expects the campaign pack, so FR-B-023
  // rule 2 must auto-link the generated pack to it.
  await prisma.control.create({
    data: {
      id: ids.control,
      code: `CTL-PKT-${suffix}`,
      title: 'Kontrol akses periodik uji',
      objective: 'Tujuan pengendalian akses periodik uji yang memadai.',
      ownerEmployeeId: ids.controlOwner,
      frequency: 'TRIWULANAN',
      controlType: 'DETEKTIF',
      nature: 'SEMI_OTOMATIS',
      riskLevel: 'TINGGI',
      expectedEvidenceTypes: ['PAKET_BUKTI_KAMPANYE'],
    },
  })
  await prisma.reviewCampaign.create({
    data: {
      id: ids.campaign,
      code: `PKT-${suffix}`,
      // Suffixed because afterAll deletes the generated pack by title, and the
      // pack's title is derived from this name. An unsuffixed name matched
      // nothing, so every run left one orphan evidence row behind for good.
      name: `Kampanye Uji Paket Bukti ${suffix}`,
      campaignType: 'AD_HOC',
      startDate: new Date('2026-06-01'),
      dueDate: new Date('2026-06-30'),
      reviewerRule: { type: 'APP_OWNER', fallback: 'SEC_OFFICER' },
      fallbackReviewerId: ids.user,
      status: 'BERJALAN',
    },
  })
  await prisma.campaignScope.create({
    data: {
      id: randomUUID(),
      campaignId: ids.campaign,
      applicationId: ids.application,
      scopeFilter: {},
      itemCount: 1,
    },
  })
  await prisma.reviewItem.create({
    data: {
      id: ids.item,
      campaignId: ids.campaign,
      snapshotLineId: ids.line,
      reviewerId: ids.user,
      status: 'DIPUTUSKAN',
    },
  })
  await prisma.reviewDecision.create({
    data: {
      id: ids.decision,
      reviewItemId: ids.item,
      decision: 'PERTAHANKAN',
      reason: 'Akses masih diperlukan untuk tugas rutin yang bersangkutan.',
      decidedBy: ids.user,
      secondsSpent: 40,
    },
  })

  principal = {
    userId: ids.user,
    externalId: `uji.paket.${suffix}`,
    employeeId: ids.employee,
    fullName: 'Penguji Paket Bukti',
    jobTitle: null,
    roles: ['SEC_OFFICER'],
    permissions: ['campaign:read', 'campaign:write', 'campaign:signoff'],
    scopes: {},
    delegatedFrom: [],
  }

  // Sign off the one decided item so the campaign reaches MENUNGGU_SIGNOFF and
  // every scope is signed -- the precondition the pack checks.
  await asUser(() =>
    campaigns.signoff(
      principal,
      ids.campaign,
      { scope: { applicationIds: [ids.application] }, statement: 'Saya menyatakan telah meninjau seluruh akses dalam cakupan.' },
      { ipAddress: '127.0.0.1' },
    ),
  )
})

afterAll(async () => {
  // Collected before the join rows go, and matched by relation rather than by
  // title: a title-shaped filter silently matches nothing the moment the title
  // is built from something other than what the filter expects, and a cleanup
  // that quietly deletes zero rows looks exactly like one that worked.
  const packIds = (
    await prisma.evidence.findMany({
      where: { campaignPackage: { some: { campaignId: ids.campaign } } },
      select: { id: true },
    })
  ).map((e) => e.id)

  await prisma.evidenceLink.deleteMany({ where: { evidence: { campaignPackage: { some: { campaignId: ids.campaign } } } } })
  await prisma.campaignEvidencePackage.deleteMany({ where: { campaignId: ids.campaign } })
  await prisma.evidence.deleteMany({ where: { id: { in: packIds } } })
  await prisma.revocationTicket.deleteMany({ where: { applicationId: ids.application } })
  await prisma.reviewDecision.deleteMany({ where: { reviewItem: { campaignId: ids.campaign } } })
  await prisma.reviewItem.deleteMany({ where: { campaignId: ids.campaign } })
  await prisma.campaignSignoff.deleteMany({ where: { campaignId: ids.campaign } })
  await prisma.campaignScope.deleteMany({ where: { campaignId: ids.campaign } })
  await prisma.reviewCampaign.deleteMany({ where: { id: ids.campaign } })
  await prisma.control.deleteMany({ where: { id: ids.control } })
  await prisma.$executeRaw`DELETE FROM public.snapshot_line WHERE snapshot_id = ${ids.snapshot}::uuid`
  await prisma.accessSnapshot.deleteMany({ where: { id: ids.snapshot } })
  await prisma.entitlementCatalog.deleteMany({ where: { id: ids.entitlement } })
  await prisma.application.deleteMany({ where: { id: ids.application } })
  try {
    await prisma.userRole.deleteMany({ where: { userId: ids.user } })
    await prisma.appUser.deleteMany({ where: { id: ids.user } })
    await prisma.employee.deleteMany({ where: { id: { in: [ids.employee, ids.controlOwner] } } })
    await prisma.organizationUnit.deleteMany({ where: { id: ids.orgUnit } })
  } catch {
    // Referenced by the audit trail; it stays, permanently and correctly (K-7).
  }
  await prisma.$disconnect()
})

describe('FR-B-022 / FR-B-023 · campaign evidence package', () => {
  it('TC-IN-B-100 · generating the pack closes the campaign and freezes eight sections', async () => {
    const pack = await asUser(() => packs.generate(principal, ids.campaign))

    // FR-B-022 rule 3: a 64-hex fingerprint over the frozen contents.
    expect(pack.contentHash).toMatch(/^[a-f0-9]{64}$/)
    // The eight sections are all present.
    const c = pack.contents
    expect(c.scope_summary.total_items).toBe(1)
    expect(c.scope_summary.decided_items).toBe(1)
    expect(c.scope_summary.undecided_items).toBe(0)
    expect(c.methodology.every_scope_signed_off).toBe(true)
    expect(c.decision_detail).toHaveLength(1)
    expect(c.signoff_records).toHaveLength(1)
    expect(c.revocation_status.total).toBe(0) // one PERTAHANKAN, no ticket
    expect(Array.isArray(c.exceptions)).toBe(true)
    expect(Array.isArray(c.anomalies)).toBe(true)
    expect(Array.isArray(c.flagged_reviewers)).toBe(true)

    // FR-B-010: the campaign is now Ditutup.
    const campaign = await prisma.reviewCampaign.findUniqueOrThrow({ where: { id: ids.campaign } })
    expect(campaign.status).toBe('DITUTUP')
  })

  it('TC-IN-B-101 · FR-B-023 · the pack is system-generated evidence linked to the periodic control', async () => {
    const pack = await asUser(() => packs.findForCampaign(principal, ids.campaign))

    const evidence = await prisma.evidence.findUniqueOrThrow({
      where: { id: pack.evidenceId },
      include: { links: true },
    })
    // Rule 1: system-generated, non-editable marker.
    expect(evidence.systemGenerated).toBe(true)
    expect(evidence.source).toBe('DIBANGKITKAN_SISTEM')
    // Rule 3: validity follows the campaign period.
    expect(evidence.validityFrom?.toISOString().slice(0, 10)).toBe('2026-06-01')
    expect(evidence.validityTo?.toISOString().slice(0, 10)).toBe('2026-06-30')

    // Rule 2: auto-linked to the periodic access control, and to the campaign.
    const controlLinks = evidence.links.filter((l) => l.targetType === 'CONTROL')
    expect(controlLinks.map((l) => l.targetId)).toContain(ids.control)
    const campaignLinks = evidence.links.filter((l) => l.targetType === 'CAMPAIGN')
    expect(campaignLinks.map((l) => l.targetId)).toContain(ids.campaign)
    expect(pack.linkedControlIds).toContain(ids.control)
  })

  it('TC-IN-B-102 · the fingerprint is stable across reads (frozen, not recomputed)', async () => {
    const a = await asUser(() => packs.findForCampaign(principal, ids.campaign))
    const b = await asUser(() => packs.findForCampaign(principal, ids.campaign))
    expect(a.contentHash).toBe(b.contentHash)
  })

  it('TC-IN-B-103 · a second generation is refused (a campaign closes once)', async () => {
    await expect(asUser(() => packs.generate(principal, ids.campaign))).rejects.toThrow(/sudah/i)
  })
})
