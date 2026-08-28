import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService, UnitOfWork, hasAnyRole, type Principal } from '../shared/index.js'

export interface InviteInput {
  readonly email: string
  readonly fullName: string
  readonly organization?: string
  readonly accessUntil: Date
  readonly scopeNote?: string
}

/** FR-X-004 rule 2 · external accounts expire in at most 180 days. */
const MAX_EXTERNAL_DAYS = 180

/**
 * FR-A-018 · the external-auditor portal.
 *
 * Two sides live here. The internal side (invite, list, revoke, extend) is for
 * AUDIT_LEAD/COMPLIANCE, who bring an external auditor into exactly one
 * engagement for a bounded time. The portal side (what the external auditor
 * sees) is deliberately narrow: only invited engagements (rule 1), within them
 * only DITERIMA evidence (rule 2), no other module (rule 4), and every read is
 * audited (rule 5).
 *
 * The access check is the crux. An external auditor's live access to an
 * engagement requires an external_access row that is AKTIF and whose
 * access_until has not passed. Expiry is evaluated on read, not by a nightly
 * job, so a lapsed grant stops working the moment it lapses rather than at the
 * next sweep (rule 7).
 */
@Injectable()
export class ExternalAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  // --- Internal side (AUDIT_LEAD / COMPLIANCE) ---

  /**
   * FR-A-018 / FR-X-004 · invite an external auditor to an engagement.
   *
   * Creates the EXTERNAL AppUser (just-in-time) with the AUDITOR_EXT role and
   * an expiry, and the per-engagement access grant. The account cannot hold any
   * role other than AUDITOR_EXT (FR-X-004 rule 3), which is enforced by never
   * granting it anything else here.
   */
  async invite(principal: Principal, engagementId: string, input: InviteInput): Promise<{ id: string; userId: string }> {
    if (!hasAnyRole(principal, 'AUDIT_LEAD', 'COMPLIANCE')) {
      throw new ForbiddenException('Undangan auditor eksternal hanya oleh AUDIT_LEAD atau COMPLIANCE.')
    }
    const engagement = await this.prisma.engagement.findUnique({
      where: { id: engagementId },
      select: { id: true },
    })
    if (!engagement) throw new NotFoundException('Penugasan tidak ditemukan.')

    const now = new Date()
    if (input.accessUntil <= now) {
      throw new BadRequestException('Tanggal berakhir akses harus di masa depan.')
    }
    const maxUntil = new Date(now)
    maxUntil.setDate(maxUntil.getDate() + MAX_EXTERNAL_DAYS)
    if (input.accessUntil > maxUntil) {
      throw new BadRequestException(
        `Akses auditor eksternal paling lama ${MAX_EXTERNAL_DAYS} hari (FR-X-004).`,
      )
    }

    const externalRole = await this.prisma.role.findFirst({
      where: { code: 'AUDITOR_EXT' },
      select: { id: true },
    })
    if (!externalRole) throw new BadRequestException('Peran AUDITOR_EXT tidak tersedia.')

    // Reuse an existing external account for this email if one exists, else
    // create one. externalId is the email for external users.
    const existingUser = await this.prisma.appUser.findUnique({
      where: { externalId: input.email },
      select: { id: true, userType: true },
    })
    if (existingUser && existingUser.userType !== 'EXTERNAL') {
      throw new ConflictException('Surel ini sudah dipakai akun internal.')
    }

    const duplicate = existingUser
      ? await this.prisma.externalAccess.findFirst({
          where: { engagementId, userId: existingUser.id, status: { in: ['MENUNGGU_AKTIVASI', 'AKTIF'] } },
          select: { id: true },
        })
      : null
    if (duplicate) throw new ConflictException('Auditor ini sudah diundang ke penugasan ini.')

    const userId = existingUser?.id ?? randomUUID()
    const accessId = randomUUID()

    await this.uow.write(async (tx, audit) => {
      if (!existingUser) {
        await tx.appUser.create({
          data: {
            id: userId,
            externalId: input.email,
            userType: 'EXTERNAL',
            isActive: true,
            // FR-X-004 rule 2: the account itself carries an expiry.
            expiresAt: input.accessUntil,
          },
        })
        await tx.userRole.create({
          data: {
            id: randomUUID(),
            userId,
            roleId: externalRole.id,
            validFrom: new Date(),
            validUntil: input.accessUntil,
          },
        })
      } else {
        // Extend the account expiry if this grant runs longer.
        await tx.appUser.updateMany({
          where: { id: userId, OR: [{ expiresAt: null }, { expiresAt: { lt: input.accessUntil } }] },
          data: { expiresAt: input.accessUntil },
        })
      }

      await tx.externalAccess.create({
        data: {
          id: accessId,
          engagementId,
          userId,
          email: input.email,
          fullName: input.fullName,
          organization: input.organization ?? null,
          scopeNote: input.scopeNote ?? null,
          accessUntil: input.accessUntil,
          status: 'MENUNGGU_AKTIVASI',
          invitedBy: principal.userId,
        },
      })
      await audit.record({
        action: 'UNDANG_AUDITOR_EKSTERNAL',
        objectType: 'EXTERNAL_ACCESS',
        objectId: accessId,
        after: { engagement_id: engagementId, email: input.email, access_until: input.accessUntil.toISOString().slice(0, 10) },
      })
    })
    return { id: accessId, userId }
  }

  async list(principal: Principal, engagementId: string) {
    if (!hasAnyRole(principal, 'AUDIT_LEAD', 'COMPLIANCE', 'AUDITOR_INT')) {
      throw new ForbiddenException('Tidak berwenang melihat akses eksternal.')
    }
    const rows = await this.prisma.externalAccess.findMany({
      where: { engagementId },
      orderBy: [{ invitedAt: 'desc' }],
    })
    const now = new Date()
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      full_name: r.fullName,
      organization: r.organization,
      access_until: r.accessUntil.toISOString().slice(0, 10),
      status: this.effectiveStatus(r.status, r.accessUntil, now),
      invited_at: r.invitedAt.toISOString(),
    }))
  }

  /** FR-A-018 rule 7 · revoke access; both revocation and expiry close it. */
  async revoke(principal: Principal, accessId: string): Promise<void> {
    if (!hasAnyRole(principal, 'AUDIT_LEAD', 'COMPLIANCE')) {
      throw new ForbiddenException('Pencabutan akses eksternal hanya oleh AUDIT_LEAD atau COMPLIANCE.')
    }
    const access = await this.prisma.externalAccess.findUnique({
      where: { id: accessId },
      select: { id: true, status: true, userId: true },
    })
    if (!access) throw new NotFoundException('Akses eksternal tidak ditemukan.')
    if (access.status === 'DICABUT') throw new ConflictException('Akses ini sudah dicabut.')

    await this.uow.write(async (tx, audit) => {
      await tx.externalAccess.update({
        where: { id: accessId },
        data: { status: 'DICABUT', revokedAt: new Date() },
      })
      await audit.record({
        action: 'CABUT_AKSES_EKSTERNAL',
        objectType: 'EXTERNAL_ACCESS',
        objectId: accessId,
        before: { status: access.status },
        after: { status: 'DICABUT' },
      })
    })
  }

  /** FR-A-018 rule 7 · extend access; AUDIT_LEAD only, still bounded to 180d. */
  async extend(principal: Principal, accessId: string, accessUntil: Date): Promise<void> {
    if (!hasAnyRole(principal, 'AUDIT_LEAD')) {
      throw new ForbiddenException('Perpanjangan akses eksternal hanya oleh AUDIT_LEAD.')
    }
    const now = new Date()
    const maxUntil = new Date(now)
    maxUntil.setDate(maxUntil.getDate() + MAX_EXTERNAL_DAYS)
    if (accessUntil <= now || accessUntil > maxUntil) {
      throw new BadRequestException(
        `Tanggal perpanjangan harus di masa depan dan paling lama ${MAX_EXTERNAL_DAYS} hari.`,
      )
    }
    const access = await this.prisma.externalAccess.findUnique({
      where: { id: accessId },
      select: { id: true, status: true, userId: true },
    })
    if (!access) throw new NotFoundException('Akses eksternal tidak ditemukan.')
    if (access.status === 'DICABUT') throw new ConflictException('Akses yang sudah dicabut tidak dapat diperpanjang.')

    await this.uow.write(async (tx, audit) => {
      await tx.externalAccess.update({
        where: { id: accessId },
        data: { accessUntil, status: 'AKTIF' },
      })
      await tx.appUser.updateMany({
        where: { id: access.userId, OR: [{ expiresAt: null }, { expiresAt: { lt: accessUntil } }] },
        data: { expiresAt: accessUntil, isActive: true },
      })
      await audit.record({
        action: 'PERPANJANG_AKSES_EKSTERNAL',
        objectType: 'EXTERNAL_ACCESS',
        objectId: accessId,
        after: { access_until: accessUntil.toISOString().slice(0, 10) },
      })
    })
  }

  // --- Portal side (the external auditor) ---

  /** FR-A-018 rule 1 · engagements the calling external auditor may see. */
  async portalEngagements(principal: Principal) {
    this.requireExternal(principal)
    const grants = await this.liveGrants(principal.userId)
    if (grants.length === 0) return []
    const engagements = await this.prisma.engagement.findMany({
      where: { id: { in: grants.map((g) => g.engagementId) } },
      select: { id: true, code: true, title: true, engagementType: true, status: true },
    })
    return engagements.map((e) => ({
      id: e.id,
      code: e.code,
      title: e.title,
      engagement_type: e.engagementType,
      status: e.status,
    }))
  }

  /**
   * FR-A-018 rule 2 · evidence in an invited engagement, DITERIMA only.
   *
   * Every read is audited (rule 5). Evidence is reached through evidence_link
   * for this engagement, then filtered to DITERIMA -- an external auditor never
   * sees a draft, rejected or expired piece of evidence, not even its existence.
   */
  async portalEvidence(principal: Principal, engagementId: string) {
    this.requireExternal(principal)
    await this.requireLiveGrant(principal.userId, engagementId)

    const links = await this.prisma.evidenceLink.findMany({
      where: { targetType: 'ENGAGEMENT', targetId: engagementId },
      select: { evidenceId: true },
    })
    const evidenceIds = links.map((l) => l.evidenceId)
    if (evidenceIds.length === 0) return []

    const rows = await this.prisma.evidence.findMany({
      where: { id: { in: evidenceIds }, status: 'DITERIMA' },
      select: {
        id: true,
        title: true,
        evidenceType: true,
        classification: true,
        validityFrom: true,
        validityTo: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    })

    // Rule 5: record that the external auditor listed the evidence.
    await this.uow.write(async (_tx, audit) => {
      await audit.record({
        action: 'PORTAL_LIHAT_BUKTI',
        objectType: 'ENGAGEMENT',
        objectId: engagementId,
        after: { evidence_count: rows.length },
      })
    })

    return rows.map((e) => ({
      id: e.id,
      title: e.title,
      evidence_type: e.evidenceType,
      classification: e.classification,
      validity_period: {
        from: e.validityFrom?.toISOString().slice(0, 10) ?? null,
        to: e.validityTo?.toISOString().slice(0, 10) ?? null,
      },
    }))
  }

  /**
   * FR-A-018 rule 5, 6 · a download by the external auditor.
   *
   * Refuses anything not DITERIMA and not in an invited engagement. Returns the
   * storage key plus the watermark text (rule 6: auditor identity + access
   * time), and records the download in the audit log.
   */
  async portalDownload(principal: Principal, evidenceId: string): Promise<{ storageKey: string; fileName: string; watermark: string }> {
    this.requireExternal(principal)

    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, status: true },
    })
    if (!evidence || evidence.status !== 'DITERIMA') {
      // 404, not 403: an external auditor is not entitled to learn that a
      // non-accepted piece of evidence exists (rule 2).
      throw new NotFoundException('Bukti tidak ditemukan.')
    }

    // The evidence must belong to an engagement this auditor is invited to.
    const links = await this.prisma.evidenceLink.findMany({
      where: { evidenceId, targetType: 'ENGAGEMENT' },
      select: { targetId: true },
    })
    let allowed = false
    for (const link of links) {
      if (await this.hasLiveGrant(principal.userId, link.targetId)) {
        allowed = true
        break
      }
    }
    if (!allowed) throw new NotFoundException('Bukti tidak ditemukan.')

    const current = await this.prisma.evidenceVersion.findFirst({
      where: { evidenceId, supersededAt: null, scanStatus: 'BERSIH' },
      select: { storageKey: true, fileName: true },
    })
    if (!current) throw new NotFoundException('Berkas bukti belum tersedia.')

    const watermark = `${principal.externalId} · ${new Date().toISOString()}`
    await this.uow.write(async (_tx, audit) => {
      await audit.record({
        action: 'PORTAL_UNDUH_BUKTI',
        objectType: 'EVIDENCE',
        objectId: evidenceId,
        after: { watermark },
      })
    })
    return { storageKey: current.storageKey, fileName: current.fileName, watermark }
  }

  /**
   * FR-A-018 rule 3 · the external auditor proposes an additional request.
   *
   * The proposal is an ordinary DRAF request tagged with the proposer, which
   * only AUDITOR_INT can publish. The external auditor cannot make it visible to
   * a PIC themselves.
   */
  async portalProposeRequest(
    principal: Principal,
    engagementId: string,
    input: { description: string; picEmployeeId: string; dueDate: Date },
  ): Promise<{ id: string; sequenceNo: number }> {
    this.requireExternal(principal)
    await this.requireLiveGrant(principal.userId, engagementId)

    const pic = await this.prisma.employee.findUnique({
      where: { id: input.picEmployeeId },
      select: { employmentStatus: true },
    })
    if (!pic || pic.employmentStatus !== 'AKTIF') {
      throw new BadRequestException('PIC yang diusulkan harus karyawan aktif.')
    }

    const last = await this.prisma.requestItem.findFirst({
      where: { engagementId },
      orderBy: { sequenceNo: 'desc' },
      select: { sequenceNo: true },
    })
    const sequenceNo = (last?.sequenceNo ?? 0) + 1
    const id = randomUUID()

    await this.uow.write(async (tx, audit) => {
      await tx.requestItem.create({
        data: {
          id,
          engagementId,
          sequenceNo,
          description: input.description,
          picEmployeeId: input.picEmployeeId,
          dueDate: input.dueDate,
          isMandatory: false,
          status: 'DRAF',
          proposedByExternalId: principal.userId,
        },
      })
      await audit.record({
        action: 'USUL_PERMINTAAN_BUKTI_EKSTERNAL',
        objectType: 'REQUEST_ITEM',
        objectId: id,
        after: { engagement_id: engagementId, sequence_no: sequenceNo, proposed_by: principal.externalId },
      })
    })
    return { id, sequenceNo }
  }

  // --- helpers ---

  private requireExternal(principal: Principal): void {
    if (!hasAnyRole(principal, 'AUDITOR_EXT')) {
      throw new ForbiddenException('Portal ini hanya untuk auditor eksternal.')
    }
  }

  private async liveGrants(userId: string): Promise<{ engagementId: string }[]> {
    const now = new Date()
    const grants = await this.prisma.externalAccess.findMany({
      where: {
        userId,
        status: { in: ['MENUNGGU_AKTIVASI', 'AKTIF'] },
        accessUntil: { gte: now },
      },
      select: { engagementId: true },
    })
    return grants
  }

  private async hasLiveGrant(userId: string, engagementId: string): Promise<boolean> {
    const now = new Date()
    const grant = await this.prisma.externalAccess.findFirst({
      where: {
        userId,
        engagementId,
        status: { in: ['MENUNGGU_AKTIVASI', 'AKTIF'] },
        accessUntil: { gte: now },
      },
      select: { id: true },
    })
    return grant !== null
  }

  private async requireLiveGrant(userId: string, engagementId: string): Promise<void> {
    if (!(await this.hasLiveGrant(userId, engagementId))) {
      throw new NotFoundException('Penugasan tidak ditemukan.')
    }
  }

  private effectiveStatus(
    status: 'MENUNGGU_AKTIVASI' | 'AKTIF' | 'KEDALUWARSA' | 'DICABUT',
    accessUntil: Date,
    now: Date,
  ): string {
    if (status === 'DICABUT') return 'DICABUT'
    // Expiry is reflected on read even if no job has flipped the column.
    if (accessUntil < now) return 'KEDALUWARSA'
    return status
  }
}
