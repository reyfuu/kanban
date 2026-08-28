import { randomUUID } from 'node:crypto'
import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { CampaignType } from '@prisma/client'
import {
  applicationScope,
  PrismaService,
  UnitOfWork,
  type Principal,
  type TransactionClient,
} from '../shared/index.js'
import {
  parseReviewerRule,
  ReviewerResolver,
  type ResolvableLine,
  type ResolvedAssignment,
  type ReviewerRule,
} from './reviewer-resolver.js'

/** FR-B-008 rule 3. */
export const MAX_SNAPSHOT_AGE_DAYS = 7
/** FR-B-009 Validasi. */
const FALLBACK_WARNING_RATIO = 0.1
/** FR-B-010 rule 1. */
const MAX_EXTENSIONS = 2

export interface CreateCampaignInput {
  readonly name: string
  readonly campaignType: CampaignType
  readonly applicationIds: readonly string[]
  readonly reviewerRule: ReviewerRule
  readonly fallbackReviewerUserId: string
  readonly startDate: Date
  readonly dueDate: Date
}

export interface CampaignPreview {
  itemCount: number
  reviewerCount: number
  applicationCount: number
  load: { lowest: number; median: number; highest: number; heaviest: { userId: string; fullName: string; itemCount: number } | null }
  blockers: { code: string; message: string; applicationId?: string }[]
  warnings: { code: string; message: string; count?: number }[]
  perApplication: {
    applicationId: string
    code: string
    name: string
    snapshotId: string | null
    snapshotAgeDays: number | null
    lineCount: number
  }[]
}

/**
 * Campaign construction (FR-B-008 s.d. FR-B-010).
 *
 * The important property of this service is that `preview` and `launch` resolve
 * assignments through the SAME code path (`resolveScope` below). A preview that
 * estimates differently from what launch does is worse than no preview: the
 * author makes a decision on numbers that will not hold, and discovers it after
 * four thousand items have been routed to the wrong people.
 */
@Injectable()
export class CampaignBuilderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ReviewerResolver,
    private readonly uow: UnitOfWork,
  ) {}

  /**
   * FR-B-001 · applications a principal may see, with snapshot freshness.
   *
   * Scope-filtered like everything else. The snapshot age is computed here
   * rather than in the screen so that "is this stale" has one definition, and
   * it is the same one `preview` turns into a launch blocker.
   */
  async listApplications(principal: Principal) {
    const scope = applicationScope(principal)

    const applications = await this.prisma.application.findMany({
      where: { AND: [scope.whereOn('id'), { isActive: true }] },
      include: {
        ownerEmployee: { select: { id: true, fullName: true } },
        techOwnerEmployee: { select: { id: true, fullName: true } },
        _count: { select: { entitlements: true } },
      },
      orderBy: { name: 'asc' },
    })

    const snapshots = await this.prisma.accessSnapshot.findMany({
      where: { applicationId: { in: applications.map((a) => a.id) }, status: 'SELESAI' },
      orderBy: { capturedAt: 'desc' },
      select: { id: true, applicationId: true, capturedAt: true },
    })
    const latest = new Map<string, { id: string; capturedAt: Date }>()
    for (const s of snapshots) if (!latest.has(s.applicationId)) latest.set(s.applicationId, s)

    return applications.map((a) => {
      const snapshot = latest.get(a.id)
      const ageDays = snapshot
        ? Math.floor((Date.now() - snapshot.capturedAt.getTime()) / 86_400_000)
        : null

      return {
        id: a.id,
        code: a.code,
        name: a.name,
        criticality: a.criticality,
        hosting_type: a.hostingType,
        review_frequency: a.reviewFrequency,
        owner: { id: a.ownerEmployee.id, full_name: a.ownerEmployee.fullName },
        tech_owner: a.techOwnerEmployee
          ? { id: a.techOwnerEmployee.id, full_name: a.techOwnerEmployee.fullName }
          : null,
        entitlement_count: a._count.entitlements,
        latest_snapshot: snapshot
          ? { id: snapshot.id, captured_at: snapshot.capturedAt.toISOString(), age_days: ageDays }
          : null,
        // FR-B-008 rule 3, decided in one place and reused by preview().
        snapshot_is_stale: ageDays === null || ageDays > MAX_SNAPSHOT_AGE_DAYS,
      }
    })
  }

  /** FR-B-008 · a campaign begins as a draft; nothing is routed yet. */
  async create(principal: Principal, input: CreateCampaignInput): Promise<{ id: string; code: string }> {
    if (input.applicationIds.length === 0) {
      throw new BadRequestException('Kampanye harus mencakup setidaknya satu aplikasi.')
    }
    if (input.dueDate < input.startDate) {
      throw new BadRequestException('Tenggat tidak boleh mendahului tanggal mulai.')
    }

    const applications = await this.prisma.application.findMany({
      where: { id: { in: [...input.applicationIds] }, isActive: true },
      select: { id: true },
    })
    if (applications.length !== new Set(input.applicationIds).size) {
      throw new NotFoundException('Sebagian aplikasi dalam cakupan tidak ditemukan atau tidak aktif.')
    }

    const fallback = await this.prisma.appUser.findFirst({
      where: { id: input.fallbackReviewerUserId, isActive: true },
      select: { id: true },
    })
    // FR-B-009 rule 1 makes the fallback mandatory, and the schema makes the
    // column NOT NULL. Checking it is active as well, because a fallback that
    // cannot log in is the same as no fallback -- items simply stop.
    if (!fallback) throw new NotFoundException('Reviewer cadangan tidak ditemukan atau tidak aktif.')

    const id = randomUUID()
    const code = await nextCampaignCode(this.prisma)

    await this.uow.write(async (tx, audit) => {
      await tx.reviewCampaign.create({
        data: {
          id,
          code,
          name: input.name,
          campaignType: input.campaignType,
          startDate: input.startDate,
          dueDate: input.dueDate,
          reviewerRule: {
            code: input.reviewerRule.code,
            ...(input.reviewerRule.specificReviewerUserId
              ? { specific_reviewer_user_id: input.reviewerRule.specificReviewerUserId }
              : {}),
          },
          fallbackReviewerId: input.fallbackReviewerUserId,
          status: 'DRAF',
        },
      })

      for (const applicationId of new Set(input.applicationIds)) {
        await tx.campaignScope.create({
          data: { id: randomUUID(), campaignId: id, applicationId, scopeFilter: {} },
        })
      }

      await audit.record({
        action: 'SUSUN_KAMPANYE',
        objectType: 'REVIEW_CAMPAIGN',
        objectId: id,
        after: {
          code,
          name: input.name,
          campaign_type: input.campaignType,
          application_ids: [...new Set(input.applicationIds)],
          reviewer_rule: input.reviewerRule.code,
          start_date: input.startDate.toISOString().slice(0, 10),
          due_date: input.dueDate.toISOString().slice(0, 10),
        },
      })
    })

    return { id, code }
  }

  /**
   * FR-B-008 rule 2 · the preview, which is screen L-09's whole reason to exist.
   *
   * Reports three separate things, and the distinction matters:
   *   blockers — launch is refused (rule 3, stale or missing snapshot)
   *   warnings — launch proceeds, but the author is told (FR-B-009 Validasi)
   *   load     — because uneven reviewer load is the main reason campaigns
   *              miss their deadline (L-09 rule 3)
   */
  async preview(campaignId: string): Promise<CampaignPreview> {
    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      include: { scopes: { include: { application: true } } },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')

    const rule = parseReviewerRule(campaign.reviewerRule)
    const scope = await this.resolveScope(campaign.scopes.map((s) => s.applicationId), rule, campaign.fallbackReviewerId)

    const blockers: CampaignPreview['blockers'] = []
    const warnings: CampaignPreview['warnings'] = []

    for (const app of scope.perApplication) {
      if (app.snapshotId === null) {
        blockers.push({
          code: 'NO_SNAPSHOT',
          applicationId: app.applicationId,
          message: `Aplikasi "${app.name}" belum memiliki snapshot akses yang selesai.`,
        })
        continue
      }
      if ((app.snapshotAgeDays ?? 0) > MAX_SNAPSHOT_AGE_DAYS) {
        blockers.push({
          code: 'SNAPSHOT_TOO_OLD',
          applicationId: app.applicationId,
          message: `Snapshot "${app.name}" berumur ${app.snapshotAgeDays} hari (batas ${MAX_SNAPSHOT_AGE_DAYS} hari).`,
        })
      }
    }

    const fallbackCount = scope.assignments.filter((a) => a.via.startsWith('FALLBACK')).length
    if (scope.assignments.length > 0 && fallbackCount / scope.assignments.length > FALLBACK_WARNING_RATIO) {
      const percent = Math.round((fallbackCount / scope.assignments.length) * 1000) / 10
      warnings.push({
        code: 'HIGH_FALLBACK_RATIO',
        count: fallbackCount,
        // FR-B-009 Validasi names the cause explicitly, because the fix is in
        // the HR data and not in this screen.
        message: `${fallbackCount} item (${percent}%) jatuh ke reviewer cadangan karena data atasan tidak lengkap.`,
      })
    }

    const privileged = scope.lines.filter((l) => l.isPrivileged).length
    if (privileged > 0) {
      warnings.push({
        code: 'PRIVILEGED_TWO_LAYER',
        count: privileged,
        message: `${privileged} item merupakan hak akses istimewa dan akan ditinjau dua lapis.`,
      })
    }

    if (scope.sodConflictCount > 0) {
      warnings.push({
        code: 'SOD_CONFLICT',
        count: scope.sodConflictCount,
        message: `${scope.sodConflictCount} item memiliki konflik pemisahan tugas dan akan ditandai.`,
      })
    }

    return {
      itemCount: scope.assignments.length,
      reviewerCount: new Set(scope.assignments.map((a) => a.reviewerUserId)).size,
      applicationCount: scope.perApplication.length,
      load: await this.loadDistribution(scope.assignments),
      blockers,
      warnings,
      perApplication: scope.perApplication,
    }
  }

  /**
   * FR-B-008 · launch.
   *
   * Rule 1's "snapshot is frozen for this campaign" is achieved by construction
   * rather than by a flag: every review_item points at a specific snapshot_line
   * row, so the campaign reviews exactly the rows that existed at launch. A
   * later snapshot creates new rows and leaves these untouched. There is no
   * freeze to forget to set, and no way for the campaign to drift onto newer
   * data.
   *
   * Rule 4 ("scope cannot change after launch") follows from the same thing:
   * this method is the only writer of review_item, and it refuses a campaign
   * that is not a draft.
   */
  async launch(principal: Principal, campaignId: string): Promise<{ itemCount: number }> {
    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      include: { scopes: true },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')
    if (campaign.status !== 'DRAF' && campaign.status !== 'DIJADWALKAN') {
      throw new ConflictException(
        `Hanya kampanye berstatus DRAF atau DIJADWALKAN yang dapat diluncurkan; kampanye ini ${campaign.status}.`,
      )
    }

    const preview = await this.preview(campaignId)
    if (preview.blockers.length > 0) {
      // L-09 rule 1: the refusal names what has to happen, because "cannot
      // launch" without a reason leaves the author with nothing to do.
      throw new ConflictException({
        message: `Kampanye tidak dapat diluncurkan: ${preview.blockers.map((b) => b.message).join(' ')}`,
        blockers: preview.blockers,
      })
    }
    if (preview.itemCount === 0) {
      throw new ConflictException('Cakupan kampanye tidak menghasilkan satu pun item review.')
    }

    const rule = parseReviewerRule(campaign.reviewerRule)
    const scope = await this.resolveScope(
      campaign.scopes.map((s) => s.applicationId),
      rule,
      campaign.fallbackReviewerId,
    )

    await this.uow.write(async (tx, audit) => {
      for (const assignment of scope.assignments) {
        await tx.reviewItem.create({
          data: {
            id: randomUUID(),
            campaignId,
            snapshotLineId: assignment.snapshotLineId,
            reviewerId: assignment.reviewerUserId,
            layerNo: assignment.layerNo,
            status: 'BELUM_DIPUTUSKAN',
          },
        })
      }

      for (const app of scope.perApplication) {
        await tx.campaignScope.updateMany({
          where: { campaignId, applicationId: app.applicationId },
          data: {
            itemCount: scope.assignments.filter((a) =>
              scope.applicationOfLine.get(a.snapshotLineId) === app.applicationId,
            ).length,
            // The snapshot each application was frozen against, recorded so the
            // evidence package can state what was reviewed without having to
            // re-derive it from the items.
            scopeFilter: { frozen_snapshot_id: app.snapshotId },
          },
        })
      }

      await tx.reviewCampaign.update({ where: { id: campaignId }, data: { status: 'BERJALAN' } })

      await audit.record({
        action: 'LUNCURKAN_KAMPANYE',
        objectType: 'REVIEW_CAMPAIGN',
        objectId: campaignId,
        before: { status: campaign.status },
        after: {
          status: 'BERJALAN',
          item_count: scope.assignments.length,
          reviewer_count: new Set(scope.assignments.map((a) => a.reviewerUserId)).size,
          frozen_snapshots: scope.perApplication.map((a) => ({
            application_id: a.applicationId,
            snapshot_id: a.snapshotId,
          })),
          // L-09 rule 2: warnings do not block, but a campaign launched over
          // them records that they were shown, so the evidence package can say
          // the author was told.
          warnings_at_launch: preview.warnings,
        },
      })
    })

    return { itemCount: scope.assignments.length }
  }

  /** FR-B-010 rule 1 · at most two extensions, each with a recorded reason. */
  async extend(
    principal: Principal,
    campaignId: string,
    input: { dueDate: Date; reason: string },
  ): Promise<void> {
    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true, dueDate: true, extensionCount: true },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')
    if (campaign.status !== 'BERJALAN' && campaign.status !== 'DIPERPANJANG') {
      throw new ConflictException(`Kampanye berstatus ${campaign.status} tidak dapat diperpanjang.`)
    }
    if (campaign.extensionCount >= MAX_EXTENSIONS) {
      throw new ConflictException(
        `Kampanye sudah diperpanjang ${MAX_EXTENSIONS} kali; perpanjangan ketiga tidak diizinkan (FR-B-010).`,
      )
    }
    if (input.dueDate <= campaign.dueDate) {
      throw new BadRequestException('Tenggat baru harus lebih lambat dari tenggat saat ini.')
    }

    await this.uow.write(async (tx, audit) => {
      await tx.reviewCampaign.update({
        where: { id: campaignId },
        data: {
          dueDate: input.dueDate,
          extensionCount: { increment: 1 },
          status: 'DIPERPANJANG',
        },
      })
      await audit.record({
        action: 'PERPANJANG_KAMPANYE',
        objectType: 'REVIEW_CAMPAIGN',
        objectId: campaignId,
        before: { due_date: campaign.dueDate.toISOString().slice(0, 10), extension_count: campaign.extensionCount },
        after: {
          due_date: input.dueDate.toISOString().slice(0, 10),
          extension_count: campaign.extensionCount + 1,
          reason: input.reason,
        },
      })
    })
  }

  /**
   * FR-B-010 rule 2 · cancellation.
   *
   * A running campaign needs COMPLIANCE. Decisions already taken are kept:
   * nothing is deleted here, the campaign simply stops accepting new ones. A
   * cancelled campaign that erased its decisions would destroy the record of
   * what people had already attested to.
   */
  async cancel(principal: Principal, campaignId: string, input: { reason: string }): Promise<void> {
    const campaign = await this.prisma.reviewCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, status: true },
    })
    if (!campaign) throw new NotFoundException('Kampanye tidak ditemukan.')
    if (campaign.status === 'DIBATALKAN' || campaign.status === 'DITUTUP') {
      throw new ConflictException(`Kampanye berstatus ${campaign.status} tidak dapat dibatalkan.`)
    }

    const isRunning = campaign.status !== 'DRAF' && campaign.status !== 'DIJADWALKAN'
    if (isRunning && !principal.roles.includes('COMPLIANCE')) {
      throw new ForbiddenException(
        'Pembatalan kampanye yang sudah berjalan memerlukan persetujuan Compliance Officer (FR-B-010).',
      )
    }

    await this.uow.write(async (tx, audit) => {
      await tx.reviewCampaign.update({ where: { id: campaignId }, data: { status: 'DIBATALKAN' } })
      await audit.record({
        action: 'BATALKAN_KAMPANYE',
        objectType: 'REVIEW_CAMPAIGN',
        objectId: campaignId,
        before: { status: campaign.status },
        after: { status: 'DIBATALKAN', reason: input.reason, approved_by_compliance: isRunning },
      })
    })
  }

  /**
   * The shared resolution both preview and launch use.
   *
   * Reads the latest completed snapshot per application, turns its lines into
   * assignments, and reports the per-application snapshot age the blockers are
   * computed from. Nothing is written.
   */
  private async resolveScope(
    applicationIds: readonly string[],
    rule: ReviewerRule,
    fallbackUserId: string,
  ) {
    const applications = await this.prisma.application.findMany({
      where: { id: { in: [...applicationIds] } },
      select: { id: true, code: true, name: true },
    })

    const perApplication: CampaignPreview['perApplication'] = []
    const lines: ResolvableLine[] = []
    const applicationOfLine = new Map<string, string>()

    for (const app of applications) {
      const snapshot = await this.prisma.accessSnapshot.findFirst({
        where: { applicationId: app.id, status: 'SELESAI' },
        orderBy: { capturedAt: 'desc' },
        select: { id: true, capturedAt: true },
      })

      if (!snapshot) {
        perApplication.push({
          applicationId: app.id,
          code: app.code,
          name: app.name,
          snapshotId: null,
          snapshotAgeDays: null,
          lineCount: 0,
        })
        continue
      }

      const rows = await this.prisma.$queryRaw<
        { id: string; employee_id: string | null; is_privileged: boolean }[]
      >`
        SELECT sl.id::text AS id, sl.employee_id::text AS employee_id, ec.is_privileged AS is_privileged
        FROM public.snapshot_line sl
        JOIN public.entitlement_catalog ec ON ec.id = sl.entitlement_id
        WHERE sl.snapshot_id = ${snapshot.id}::uuid
      `

      for (const row of rows) {
        lines.push({
          snapshotLineId: row.id,
          employeeId: row.employee_id,
          applicationId: app.id,
          isPrivileged: row.is_privileged,
        })
        applicationOfLine.set(row.id, app.id)
      }

      perApplication.push({
        applicationId: app.id,
        code: app.code,
        name: app.name,
        snapshotId: snapshot.id,
        snapshotAgeDays: Math.floor((Date.now() - snapshot.capturedAt.getTime()) / 86_400_000),
        lineCount: rows.length,
      })
    }

    const directory = await this.resolver.loadDirectory(applicationIds)
    const assignments = this.resolver.resolve(lines, rule, fallbackUserId, directory)

    const employeeIds = [...new Set(lines.map((l) => l.employeeId).filter((v): v is string => v !== null))]
    const sodConflictCount =
      employeeIds.length === 0
        ? 0
        : await this.prisma.sodViolation.count({
            where: { employeeId: { in: employeeIds }, status: 'TERBUKA' },
          })

    return { lines, assignments, perApplication, applicationOfLine, sodConflictCount }
  }

  private async loadDistribution(assignments: readonly ResolvedAssignment[]): Promise<CampaignPreview['load']> {
    if (assignments.length === 0) {
      return { lowest: 0, median: 0, highest: 0, heaviest: null }
    }

    const counts = new Map<string, number>()
    for (const a of assignments) counts.set(a.reviewerUserId, (counts.get(a.reviewerUserId) ?? 0) + 1)

    const sorted = [...counts.values()].sort((a, b) => a - b)
    const median = sorted[Math.floor(sorted.length / 2)] ?? 0
    const [heaviestUserId, heaviestCount] = [...counts.entries()].reduce((max, entry) =>
      entry[1] > max[1] ? entry : max,
    )

    const user = await this.prisma.appUser.findUnique({
      where: { id: heaviestUserId },
      include: { employee: { select: { fullName: true } } },
    })

    return {
      lowest: sorted[0] ?? 0,
      median,
      highest: sorted.at(-1) ?? 0,
      heaviest: {
        userId: heaviestUserId,
        fullName: user?.employee?.fullName ?? user?.externalId ?? '—',
        itemCount: heaviestCount,
      },
    }
  }
}

/** Campaign codes are sequential per year: UAR-2026-003. */
async function nextCampaignCode(prisma: PrismaService | TransactionClient): Promise<string> {
  const year = new Date().getFullYear()
  const rows = await prisma.$queryRaw<{ next: bigint }[]>`
    SELECT coalesce(max(substring(code from '[0-9]+$')::bigint), 0) + 1 AS next
    FROM public.review_campaign
    WHERE code LIKE ${`UAR-${year}-%`}
  `
  return `UAR-${year}-${String(rows[0]?.next ?? 1n).padStart(3, '0')}`
}
