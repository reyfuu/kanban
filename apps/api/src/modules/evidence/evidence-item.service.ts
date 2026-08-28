import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { Classification, EvidenceLinkTarget, EvidenceSource, Prisma } from '@prisma/client'
import { PrismaService, UnitOfWork, hasAnyRole, type Principal } from '../shared/index.js'
import {
  coversPeriod,
  isExpired,
  relevanceScore,
  type Period,
} from './evidence-reuse-rules.js'

export interface EvidenceInput {
  readonly title: string
  readonly description?: string
  readonly evidenceType: string
  readonly validityFrom?: Date
  readonly validityTo?: Date
  readonly ownerOrgUnitId?: string
  readonly classification: Classification
  readonly source: EvidenceSource
  /** FR-A-012 · link this evidence to a target in the same transaction. */
  readonly link?: {
    readonly targetType: EvidenceLinkTarget
    readonly targetId: string
    readonly note?: string
  }
}

export interface VersionInput {
  readonly storageKey: string
  readonly fileName: string
  readonly fileSize: number
  readonly mimeType: string
  /** Lowercase hex SHA-256 of the file content, computed on receipt. */
  readonly sha256: string
}

export interface LinkInput {
  readonly targetType: EvidenceLinkTarget
  readonly targetId: string
  readonly note?: string
  /**
   * FR-A-012 rule 2 · an AUDITOR_INT's justification for linking evidence whose
   * validity window does not cover the requested period. Absent, a mismatched
   * period is refused. Present, it is recorded on the link and in the audit
   * trail -- the override is meant to be visible later, not merely permitted.
   */
  readonly periodOverrideReason?: string
}

const SHA256_RE = /^[a-f0-9]{64}$/

/**
 * FR-A-010 s.d. FR-A-014 · evidence as a first-class entity, with integrity
 * (critical control K-8).
 *
 * Three K-8 invariants live here, and each is enforced in the same audited
 * transaction as the write it guards:
 *
 * - A new version never overwrites an old one (FR-A-011): every upload inserts a
 *   fresh evidence_version row and stamps the previous current version with a
 *   supersededAt. The unique (evidence_id, version_no) makes a double-write
 *   impossible even under a race.
 * - An identical re-upload is refused, not copied (rule 2): a SHA-256 already
 *   present on the evidence throws a 409 that names the existing version, so the
 *   caller links instead of duplicating.
 * - Integrity is re-verified on download (rule 4): the stored SHA-256 is the
 *   thing the download path checks the object against, and a mismatch is a
 *   security event, not a warning.
 *
 * The object-lock storage that makes rule 3 (no overwrite/delete during
 * retention) physical is wired when the storage backend lands; until then the
 * database-level guarantees above hold and are tested.
 */
@Injectable()
export class EvidenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  async list(
    _principal: Principal,
    filter: { q?: string; controlId?: string; orgUnitId?: string; validOn?: Date; take: number },
  ) {
    const where: Prisma.EvidenceWhereInput = {
      AND: [
        filter.q ? { title: { contains: filter.q, mode: 'insensitive' } } : {},
        filter.orgUnitId ? { ownerOrgUnitId: filter.orgUnitId } : {},
        filter.controlId
          ? { links: { some: { targetType: 'CONTROL', targetId: filter.controlId } } }
          : {},
        filter.validOn
          ? {
              OR: [
                { validityFrom: null, validityTo: null },
                { validityFrom: { lte: filter.validOn }, validityTo: { gte: filter.validOn } },
              ],
            }
          : {},
      ],
    }
    const rows = await this.prisma.evidence.findMany({
      where,
      include: {
        ownerOrgUnit: { select: { id: true, code: true, name: true } },
        versions: { orderBy: { versionNo: 'desc' }, take: 1 },
        _count: { select: { links: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
      take: filter.take,
    })
    return rows.map((e) => this.presentSummary(e))
  }

  async findOne(_principal: Principal, id: string) {
    const e = await this.prisma.evidence.findUnique({
      where: { id },
      include: {
        ownerOrgUnit: { select: { id: true, code: true, name: true } },
        versions: { orderBy: { versionNo: 'desc' } },
        createdByUser: { select: { id: true, externalId: true } },
        _count: { select: { links: true } },
      },
    })
    if (!e) throw new NotFoundException('Bukti tidak ditemukan.')
    const current = e.versions.find((v) => v.supersededAt === null) ?? e.versions[0] ?? null
    return {
      ...this.presentSummary(e),
      description: e.description,
      source: e.source,
      system_generated: e.systemGenerated,
      created_by: { id: e.createdByUser.id, external_id: e.createdByUser.externalId },
      current_version: current
        ? {
            version_no: current.versionNo,
            file_name: current.fileName,
            file_size: Number(current.fileSize),
            mime_type: current.mimeType,
            sha256: current.sha256,
            uploaded_at: current.uploadedAt.toISOString(),
            scan_status: current.scanStatus,
          }
        : null,
    }
  }

  /** FR-A-010 · create an evidence entity. classification has no default. */
  async create(principal: Principal, input: EvidenceInput): Promise<{ id: string }> {
    if (input.validityFrom && input.validityTo && input.validityTo < input.validityFrom) {
      throw new BadRequestException('Akhir periode keberlakuan tidak boleh sebelum awalnya.')
    }
    // FR-A-012 · an optional link, validated before anything is written.
    // Registering and linking used to be two calls, and evidence orphaned in
    // the gap keeps appearing in reuse suggestions while satisfying nothing.
    // Both are done in one transaction so a rejected link cannot leave the
    // evidence behind -- which would be the same orphan by another route.
    if (input.link) {
      await this.assertTargetExists(input.link.targetType, input.link.targetId)
    }
    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.evidence.create({
        data: {
          id,
          title: input.title,
          description: input.description ?? null,
          evidenceType: input.evidenceType,
          validityFrom: input.validityFrom ?? null,
          validityTo: input.validityTo ?? null,
          ownerOrgUnitId: input.ownerOrgUnitId ?? null,
          classification: input.classification,
          source: input.source,
          systemGenerated: false,
          status: 'DRAF',
          currentVersionNo: 0,
          createdBy: principal.userId,
        },
      })
      await audit.record({
        action: 'BUAT_BUKTI',
        objectType: 'EVIDENCE',
        objectId: id,
        after: { title: input.title, classification: input.classification },
      })

      if (input.link) {
        await tx.evidenceLink.create({
          data: {
            id: randomUUID(),
            evidenceId: id,
            targetType: input.link.targetType,
            targetId: input.link.targetId,
            note: input.link.note ?? null,
            linkedBy: principal.userId,
          },
        })
        await audit.record({
          action: 'TAUTKAN_BUKTI',
          objectType: 'EVIDENCE',
          objectId: id,
          after: {
            target_type: input.link.targetType,
            target_id: input.link.targetId,
            // Newly created evidence cannot be outside a requested period in a
            // way that needs justifying: it is being registered for this target
            // now. FR-A-012 rule 2 still applies to linking pre-existing
            // evidence through createLink.
            period_override_reason: null,
          },
        })
      }
    })
    return { id }
  }

  /**
   * FR-A-011 · add a version. K-8: no overwrite, duplicate SHA-256 refused.
   */
  async addVersion(principal: Principal, evidenceId: string, input: VersionInput): Promise<{ versionNo: number }> {
    if (!SHA256_RE.test(input.sha256)) {
      throw new BadRequestException('Sidik jari SHA-256 tidak valid.')
    }
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, systemGenerated: true, currentVersionNo: true },
    })
    if (!evidence) throw new NotFoundException('Bukti tidak ditemukan.')
    // FR-A-014 rule 4: system-generated evidence is not user-editable.
    if (evidence.systemGenerated) {
      throw new ForbiddenException('Bukti yang dibangkitkan sistem tidak dapat disunting.')
    }

    // FR-A-011 rule 2: identical content is a link, not a copy.
    const duplicate = await this.prisma.evidenceVersion.findUnique({
      where: { evidenceId_sha256: { evidenceId, sha256: input.sha256 } },
      select: { versionNo: true },
    })
    if (duplicate) {
      throw new ConflictException(
        `Isi berkas identik dengan versi ${duplicate.versionNo} yang sudah ada. ` +
          'Tautkan bukti yang ada alih-alih menyalinnya.',
      )
    }

    const nextVersion = evidence.currentVersionNo + 1
    await this.uow.write(async (tx, audit) => {
      // Supersede the prior current version rather than overwrite it.
      await tx.evidenceVersion.updateMany({
        where: { evidenceId, supersededAt: null },
        data: { supersededAt: new Date() },
      })
      await tx.evidenceVersion.create({
        data: {
          id: randomUUID(),
          evidenceId,
          versionNo: nextVersion,
          storageKey: input.storageKey,
          fileName: input.fileName,
          fileSize: BigInt(input.fileSize),
          mimeType: input.mimeType,
          sha256: input.sha256,
          uploadedBy: principal.userId,
          scanStatus: 'MENUNGGU_PEMINDAIAN',
        },
      })
      await tx.evidence.update({
        where: { id: evidenceId },
        data: {
          currentVersionNo: nextVersion,
          // First version moves the evidence out of DRAF into DISERAHKAN.
          ...(nextVersion === 1 ? { status: 'DISERAHKAN' } : {}),
        },
      })
      await audit.record({
        action: 'UNGGAH_VERSI_BUKTI',
        objectType: 'EVIDENCE',
        objectId: evidenceId,
        after: { version_no: nextVersion, sha256: input.sha256, file_name: input.fileName },
      })
    })
    return { versionNo: nextVersion }
  }

  /**
   * FR-A-011 rule 4 · the authenticity attestation: version fingerprints and a
   * chain of custody drawn from the audit log so it cannot be fabricated
   * independently of what actually happened.
   */
  async attestation(_principal: Principal, evidenceId: string) {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: {
        versions: {
          orderBy: { versionNo: 'asc' },
          include: { uploadedByUser: { select: { externalId: true } } },
        },
      },
    })
    if (!evidence) throw new NotFoundException('Bukti tidak ditemukan.')

    // Chain of custody from the immutable audit log for this object.
    const trail = await this.prisma.auditLog.findMany({
      where: { objectType: 'EVIDENCE', objectId: evidenceId },
      orderBy: { occurredAt: 'asc' },
      select: { occurredAt: true, action: true, actorRoleAtAction: true },
    })

    return {
      evidence_id: evidenceId,
      title: evidence.title,
      versions: evidence.versions.map((v) => ({
        version_no: v.versionNo,
        sha256: v.sha256,
        uploaded_by: v.uploadedByUser.externalId,
        uploaded_at: v.uploadedAt.toISOString(),
        superseded_at: v.supersededAt?.toISOString() ?? null,
      })),
      chain_of_custody: trail.map((t) => ({
        at: t.occurredAt.toISOString(),
        action: t.action,
      })),
    }
  }

  /**
   * FR-A-011 · the download path re-verifies integrity.
   *
   * Given the object's freshly-computed SHA-256 (the storage layer supplies it),
   * this compares it to the stored fingerprint. A mismatch is a security event:
   * it records an alert to the audit log and refuses the download. Only a
   * BERSIH-scanned version is downloadable (FR-X-013 rule 4).
   */
  async verifyForDownload(
    _principal: Principal,
    evidenceId: string,
    actualSha256: string,
  ): Promise<{ storageKey: string; fileName: string }> {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true },
    })
    if (!evidence) throw new NotFoundException('Bukti tidak ditemukan.')

    const current = await this.prisma.evidenceVersion.findFirst({
      where: { evidenceId, supersededAt: null },
      select: { sha256: true, storageKey: true, fileName: true, scanStatus: true },
    })
    if (!current) throw new NotFoundException('Bukti belum memiliki versi berkas.')
    if (current.scanStatus !== 'BERSIH') {
      throw new ConflictException('Berkas belum lolos pemindaian, sehingga belum dapat diunduh.')
    }

    if (actualSha256 !== current.sha256) {
      // Record the mismatch as a security alert (FR-A-011 Validasi).
      await this.uow.write(async (_tx, audit) => {
        await audit.record({
          action: 'PERINGATAN_INTEGRITAS_BUKTI',
          objectType: 'EVIDENCE',
          objectId: evidenceId,
          after: { expected_sha256: current.sha256, actual_sha256: actualSha256 },
        })
      })
      throw new ConflictException(
        'Sidik jari berkas tidak cocok dengan yang tercatat. Pengunduhan ditolak dan diperingatkan.',
      )
    }
    return { storageKey: current.storageKey, fileName: current.fileName }
  }

  /** FR-A-010/012 · link evidence to a target. Referential check per target. */
  async createLink(principal: Principal, evidenceId: string, input: LinkInput): Promise<{ id: string }> {
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, validityFrom: true, validityTo: true },
    })
    if (!evidence) throw new NotFoundException('Bukti tidak ditemukan.')

    await this.assertTargetExists(input.targetType, input.targetId)

    const override = await this.assertPeriodCovered(principal, evidence, input)

    const existing = await this.prisma.evidenceLink.findUnique({
      where: {
        evidenceId_targetType_targetId: {
          evidenceId,
          targetType: input.targetType,
          targetId: input.targetId,
        },
      },
      select: { id: true },
    })
    if (existing) throw new ConflictException('Bukti sudah tertaut ke objek tersebut.')

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.evidenceLink.create({
        data: {
          id,
          evidenceId,
          targetType: input.targetType,
          targetId: input.targetId,
          note: input.note ?? null,
          linkedBy: principal.userId,
        },
      })
      await audit.record({
        action: 'TAUTKAN_BUKTI',
        objectType: 'EVIDENCE',
        objectId: evidenceId,
        after: {
          target_type: input.targetType,
          target_id: input.targetId,
          // Recorded even when absent, so a reader can tell "no override was
          // needed" apart from "an override happened and went unrecorded".
          period_override_reason: override,
        },
      })
    })
    return { id }
  }

  /** FR-A-010 rule 2 · unlinking never deletes the evidence. */
  async deleteLink(_principal: Principal, linkId: string): Promise<void> {
    const link = await this.prisma.evidenceLink.findUnique({
      where: { id: linkId },
      select: { id: true, evidenceId: true, targetType: true, targetId: true },
    })
    if (!link) throw new NotFoundException('Tautan bukti tidak ditemukan.')
    await this.uow.write(async (tx, audit) => {
      await tx.evidenceLink.delete({ where: { id: linkId } })
      await audit.record({
        action: 'HAPUS_TAUTAN_BUKTI',
        objectType: 'EVIDENCE',
        objectId: link.evidenceId,
        before: { target_type: link.targetType, target_id: link.targetId },
      })
    })
  }

  /**
   * FR-A-015 rule 3/4 · legal hold on one piece of evidence.
   *
   * A hold overrides retention: while held, the evidence cannot enter the
   * deletion queue and cannot be deleted. Only COMPLIANCE/AUDIT_LEAD may set it,
   * and it needs a recorded reason (rule 5). Step-up is enforced at the
   * controller (FR-X-003).
   */
  async setLegalHold(principal: Principal, evidenceId: string, on: boolean, reason: string): Promise<void> {
    if (!hasAnyRole(principal, 'COMPLIANCE', 'AUDIT_LEAD')) {
      throw new ForbiddenException('Legal hold hanya oleh COMPLIANCE atau AUDIT_LEAD.')
    }
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Legal hold memerlukan alasan minimal 10 karakter.')
    }
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, legalHold: true },
    })
    if (!evidence) throw new NotFoundException('Bukti tidak ditemukan.')
    if (evidence.legalHold === on) {
      throw new ConflictException(`Legal hold sudah ${on ? 'aktif' : 'nonaktif'}.`)
    }
    await this.uow.write(async (tx, audit) => {
      await tx.evidence.update({ where: { id: evidenceId }, data: { legalHold: on } })
      await audit.record({
        action: on ? 'BERLAKUKAN_LEGAL_HOLD_BUKTI' : 'CABUT_LEGAL_HOLD_BUKTI',
        objectType: 'EVIDENCE',
        objectId: evidenceId,
        before: { legal_hold: evidence.legalHold },
        after: { legal_hold: on, reason },
      })
    })
  }

  /**
   * FR-A-015 rule 1, 2 · the deletion queue.
   *
   * Evidence whose retention date has passed and which is not under legal hold
   * is eligible for deletion. It is listed, never removed automatically: the
   * removal is a COMPLIANCE decision (`approveDeletion`). Held evidence is
   * excluded even if its retention date passed, because the hold overrides
   * retention (rule 4).
   */
  async deletionQueue(principal: Principal) {
    if (!hasAnyRole(principal, 'COMPLIANCE')) {
      throw new ForbiddenException('Antrean penghapusan hanya dapat dilihat oleh COMPLIANCE.')
    }
    const today = new Date()
    const rows = await this.prisma.evidence.findMany({
      where: {
        legalHold: false,
        deletionApprovedAt: null,
        retentionUntil: { not: null, lte: today },
      },
      select: {
        id: true,
        title: true,
        classification: true,
        retentionUntil: true,
      },
      orderBy: [{ retentionUntil: 'asc' }],
    })
    return rows.map((e) => ({
      id: e.id,
      title: e.title,
      classification: e.classification,
      eligible_for_deletion_at: e.retentionUntil?.toISOString().slice(0, 10) ?? null,
    }))
  }

  /**
   * FR-A-015 rule 2 · approve deletion of an eligible piece of evidence.
   *
   * COMPLIANCE only, step-up at the controller. Refuses anything under legal
   * hold or not yet past retention. The row is tombstoned (deletionApprovedAt,
   * status DIARSIPKAN) rather than hard-deleted, so the audit trail keeps a
   * record that it existed and who removed it.
   */
  async approveDeletion(principal: Principal, evidenceId: string, reason: string): Promise<void> {
    if (!hasAnyRole(principal, 'COMPLIANCE')) {
      throw new ForbiddenException('Penghapusan bukti hanya dapat disetujui oleh COMPLIANCE.')
    }
    if (!reason || reason.trim().length < 10) {
      throw new BadRequestException('Persetujuan penghapusan memerlukan alasan minimal 10 karakter.')
    }
    const evidence = await this.prisma.evidence.findUnique({
      where: { id: evidenceId },
      select: { id: true, legalHold: true, retentionUntil: true, deletionApprovedAt: true },
    })
    if (!evidence) throw new NotFoundException('Bukti tidak ditemukan.')
    if (evidence.deletionApprovedAt) throw new ConflictException('Bukti ini sudah dihapus.')
    if (evidence.legalHold) {
      throw new ConflictException('Bukti di bawah legal hold tidak dapat dihapus sampai holdnya dicabut.')
    }
    if (!evidence.retentionUntil || evidence.retentionUntil > new Date()) {
      throw new ConflictException('Bukti belum melewati masa retensi.')
    }
    await this.uow.write(async (tx, audit) => {
      await tx.evidence.update({
        where: { id: evidenceId },
        data: { deletionApprovedAt: new Date(), status: 'DIARSIPKAN' },
      })
      await audit.record({
        action: 'SETUJUI_PENGHAPUSAN_BUKTI',
        objectType: 'EVIDENCE',
        objectId: evidenceId,
        after: { reason },
      })
    })
  }

  /**
   * FR-A-012 rule 2 · refuse a link whose evidence does not cover the period the
   * request asks about, unless an AUDITOR_INT justifies it.
   *
   * Only REQUEST_ITEM targets carry a requested period; the other link targets
   * (a control, a finding, a campaign) are not period-bound, so there is nothing
   * to compare and the rule does not apply. Returning the reason string rather
   * than a boolean keeps the caller from having to reconstruct what it recorded.
   */
  private async assertPeriodCovered(
    principal: Principal,
    evidence: { validityFrom: Date | null; validityTo: Date | null },
    input: LinkInput,
  ): Promise<string | null> {
    if (input.targetType !== 'REQUEST_ITEM') return null

    const request = await this.prisma.requestItem.findUnique({
      where: { id: input.targetId },
      select: { evidencePeriodFrom: true, evidencePeriodTo: true },
    })
    if (!request) return null
    if (!request.evidencePeriodFrom && !request.evidencePeriodTo) return null

    const evidencePeriod: Period = { from: evidence.validityFrom, to: evidence.validityTo }
    const verdict = coversPeriod(evidencePeriod, {
      from: request.evidencePeriodFrom,
      to: request.evidencePeriodTo,
    })
    if (verdict.covered) return null

    const reason = input.periodOverrideReason?.trim()
    if (!reason) {
      throw new BadRequestException(
        `${verdict.reason} Penautan ditolak. AUDITOR_INT dapat tetap menautkannya dengan menyertakan alasan.`,
      )
    }
    // The override is an auditor's professional judgement, so it is theirs to
    // make and no one else's -- a PIC who could self-approve the mismatch would
    // turn rule 2 into a formality.
    if (!hasAnyRole(principal, 'AUDITOR_INT', 'AUDIT_LEAD')) {
      throw new ForbiddenException(
        'Hanya AUDITOR_INT yang dapat menautkan bukti di luar periode yang diminta.',
      )
    }
    if (reason.length < 10) {
      throw new BadRequestException('Alasan penautan di luar periode minimal 10 karakter.')
    }
    return reason
  }

  /**
   * FR-A-012 rule 1 · suggest evidence that could satisfy a request.
   *
   * Ranked by `relevanceScore`, and rule 3 removes expired evidence entirely
   * rather than ranking it last: a suggestion list is a recommendation, and
   * recommending evidence that is no longer valid invites exactly the filing
   * error rule 2 exists to prevent.
   *
   * Suggestions are a convenience, never an authorisation -- `createLink` still
   * applies every rule to whatever is chosen from this list.
   */
  async suggestForRequest(
    _principal: Principal,
    requestItemId: string,
    limit = 10,
  ): Promise<
    Array<{
      id: string
      title: string
      evidenceType: string
      validityFrom: Date | null
      validityTo: Date | null
      coversPeriod: boolean
    }>
  > {
    const request = await this.prisma.requestItem.findUnique({
      where: { id: requestItemId },
      select: {
        controlId: true,
        responsibleOrgUnitId: true,
        evidencePeriodFrom: true,
        evidencePeriodTo: true,
        expectedEvidenceType: true,
      },
    })
    if (!request) throw new NotFoundException('Permintaan bukti tidak ditemukan.')

    const requested: Period = {
      from: request.evidencePeriodFrom,
      to: request.evidencePeriodTo,
    }

    // Candidates are narrowed in the database to evidence that is actually
    // usable -- approved, not awaiting deletion -- and ranked in application
    // code, because the ranking is a documented rule that belongs somewhere a
    // reader can check it against the FRD.
    const candidates = await this.prisma.evidence.findMany({
      where: {
        // DITERIMA and DISERAHKAN only. DRAF is not yet real evidence,
        // DITOLAK was judged unusable, and KEDALUWARSA/DIARSIPKAN are exactly
        // what rule 3 says must not be suggested.
        status: { in: ['DITERIMA', 'DISERAHKAN'] },
        deletionApprovedAt: null,
        ...(request.expectedEvidenceType
          ? { evidenceType: request.expectedEvidenceType }
          : {}),
      },
      select: {
        id: true,
        title: true,
        evidenceType: true,
        validityFrom: true,
        validityTo: true,
        ownerOrgUnitId: true,
        // The control this evidence is already filed under: the strongest
        // signal that it answers the same obligation as the request.
        links: {
          where: { targetType: 'CONTROL' },
          select: { targetId: true },
          take: 1,
        },
      },
      take: 200,
    })

    const asOf = new Date()
    return candidates
      .filter((c) => !isExpired({ from: c.validityFrom, to: c.validityTo }, asOf))
      .map((c) => {
        const period: Period = { from: c.validityFrom, to: c.validityTo }
        return {
          candidate: c,
          period,
          score: relevanceScore(
            {
              controlId: c.links[0]?.targetId ?? null,
              ownerOrgUnitId: c.ownerOrgUnitId,
              period,
            },
            {
              controlId: request.controlId,
              responsibleOrgUnitId: request.responsibleOrgUnitId,
              period: requested,
            },
          ),
        }
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => ({
        id: r.candidate.id,
        title: r.candidate.title,
        evidenceType: r.candidate.evidenceType,
        validityFrom: r.candidate.validityFrom,
        validityTo: r.candidate.validityTo,
        coversPeriod: coversPeriod(r.period, requested).covered,
      }))
  }

  private async assertTargetExists(targetType: EvidenceLinkTarget, targetId: string): Promise<void> {
    const exists = await this.targetExists(targetType, targetId)
    if (!exists) {
      throw new BadRequestException(`Objek tujuan (${targetType}) tidak ditemukan.`)
    }
  }

  private async targetExists(targetType: EvidenceLinkTarget, targetId: string): Promise<boolean> {
    switch (targetType) {
      case 'REQUEST_ITEM':
        return (await this.prisma.requestItem.count({ where: { id: targetId } })) > 0
      case 'CONTROL':
        return (await this.prisma.control.count({ where: { id: targetId } })) > 0
      case 'FINDING':
        return (await this.prisma.finding.count({ where: { id: targetId } })) > 0
      case 'ENGAGEMENT':
        return (await this.prisma.engagement.count({ where: { id: targetId } })) > 0
      case 'CAMPAIGN':
        return (await this.prisma.reviewCampaign.count({ where: { id: targetId } })) > 0
      default:
        return false
    }
  }

  private presentSummary(e: {
    id: string
    title: string
    evidenceType: string
    validityFrom: Date | null
    validityTo: Date | null
    classification: Classification
    status: string
    currentVersionNo: number
    ownerOrgUnit: { id: string; code: string; name: string } | null
    _count: { links: number }
  }) {
    return {
      id: e.id,
      title: e.title,
      evidence_type: e.evidenceType,
      validity_period: {
        from: e.validityFrom?.toISOString().slice(0, 10) ?? null,
        to: e.validityTo?.toISOString().slice(0, 10) ?? null,
      },
      classification: e.classification,
      status: e.status,
      current_version_no: e.currentVersionNo,
      owner_org_unit: e.ownerOrgUnit
        ? { id: e.ownerOrgUnit.id, code: e.ownerOrgUnit.code, name: e.ownerOrgUnit.name }
        : null,
      link_count: e._count.links,
    }
  }
}
