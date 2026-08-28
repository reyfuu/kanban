import { randomUUID } from 'node:crypto'
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import type { AttestationTargetKind, Prisma } from '@prisma/client'
import { PrismaService, UnitOfWork, type Principal, type TransactionClient } from '../shared/index.js'

export interface CreateAttestationCampaignInput {
  readonly name: string
  readonly description?: string | null
  readonly documentIds: readonly string[]
  readonly targetKind: AttestationTargetKind
  readonly targetParams: Record<string, unknown>
  readonly startDate: Date
  readonly dueDate: Date
  readonly isMandatory: boolean
  readonly autoEnrollNewEmployees: boolean
}

/**
 * FR-C-019 s.d. FR-C-021 · policy attestation.
 *
 * The module answers one question an auditor always asks and most systems
 * cannot: *can you show me that the people bound by this procedure have read
 * it?* Three design choices carry that:
 *
 * - **A task is an obligation; a record is a fact.** They are separate tables,
 *   so "has not attested" is a row rather than the absence of one. FR-C-021 is
 *   precisely the question "who is outstanding", which an attestations-only
 *   design cannot answer.
 *
 * - **A record names the VERSION, not the document** (FR-C-020). Someone who
 *   read version 1.0 has not read 2.0, and a record naming only the document
 *   would silently claim otherwise the moment the policy is revised.
 *
 * - **The viewing gate is enforced server-side** (FR-C-020 aturan 1 & 2). A
 *   disabled button is not a control: anyone can post to the endpoint. So the
 *   server holds a floor on dwell time and stores what it observed, which makes
 *   an implausible attestation visible in the data instead of invisible.
 *
 * FR-C-020 aturan 3 -- an attestation cannot be withdrawn -- is enforced by the
 * database grant, not here: the application role holds INSERT and SELECT on
 * attestation_record and nothing else.
 */
@Injectable()
export class AttestationService {
  /**
   * The server-side floor on dwell time, in seconds.
   *
   * Deliberately low. It is not a reading-speed model -- people skim documents
   * they already know, and a high floor would train them to leave a tab open
   * and do something else, which is worse evidence than an honest short view.
   * It exists to reject the zero-second scripted POST, and everything above the
   * floor is recorded for a human to judge.
   */
  private static readonly MIN_SECONDS_VIEWED = 5

  /** Beyond this many lines, "scrolled to the end" is required (aturan 2). */
  private static readonly LONG_DOCUMENT_LINES = 40

  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /** FR-C-019 · create the campaign as a draft. Targets are resolved at launch. */
  async create(
    principal: Principal,
    input: CreateAttestationCampaignInput,
  ): Promise<{ id: string }> {
    if (input.documentIds.length === 0) {
      throw new BadRequestException('Kampanye attestation harus mencakup minimal satu dokumen.')
    }
    if (input.dueDate < input.startDate) {
      throw new BadRequestException('Tenggat tidak boleh mendahului tanggal mulai.')
    }

    // FR-C-019 aturan 1 · only documents in force. Asking people to attest to a
    // draft would have them acknowledge a rule that does not bind them yet.
    const documents = await this.prisma.document.findMany({
      where: { id: { in: [...input.documentIds] } },
      select: { id: true, title: true, status: true },
    })
    if (documents.length !== input.documentIds.length) {
      throw new BadRequestException('Sebagian dokumen tidak ditemukan.')
    }
    const notInForce = documents.filter((d) => d.status !== 'BERLAKU')
    if (notInForce.length > 0) {
      throw new ConflictException(
        `Kampanye hanya dapat mencakup dokumen berstatus Berlaku. ` +
          `Belum berlaku: ${notInForce.map((d) => d.title).join(', ')}.`,
      )
    }

    this.assertTargetParams(input.targetKind, input.targetParams)

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.attestationCampaign.create({
        data: {
          id,
          name: input.name,
          description: input.description ?? null,
          targetKind: input.targetKind,
          targetParams: input.targetParams as Prisma.InputJsonValue,
          startDate: input.startDate,
          dueDate: input.dueDate,
          isMandatory: input.isMandatory,
          autoEnrollNewEmployees: input.autoEnrollNewEmployees,
          status: 'DRAF',
          createdBy: principal.userId,
        },
      })
      await audit.record({
        action: 'BUAT_KAMPANYE_ATTESTATION',
        objectType: 'ATTESTATION_CAMPAIGN',
        objectId: id,
        after: {
          name: input.name,
          documents: input.documentIds.length,
          target_kind: input.targetKind,
        },
      })
    })

    // Document entries are written after the campaign row exists; the version
    // each one pins is resolved at launch, not now, because the campaign may
    // sit in draft while a revision takes force.
    await this.uow.write(async (tx, audit) => {
      for (const documentId of input.documentIds) {
        const inForce = await tx.documentVersion.findFirst({
          where: { documentId, status: 'BERLAKU' },
          select: { id: true },
        })
        if (!inForce) {
          throw new ConflictException(
            'Dokumen berstatus Berlaku tetapi tidak memiliki versi berlaku; data tidak konsisten.',
          )
        }
        await tx.attestationCampaignDocument.create({
          data: { id: randomUUID(), campaignId: id, documentId, versionId: inForce.id },
        })
      }
      await audit.record({
        action: 'TETAPKAN_DOKUMEN_ATTESTATION',
        objectType: 'ATTESTATION_CAMPAIGN',
        objectId: id,
        after: { document_ids: [...input.documentIds] },
      })
    })

    return { id }
  }

  /**
   * FR-C-019 · launch: materialise the target population into tasks.
   *
   * Resolved once, here, rather than evaluated on every read. "Who was required
   * to read this policy in March" is a historical fact; an org chart that
   * changes in April must not silently rewrite it.
   */
  async launch(principal: Principal, campaignId: string): Promise<{ tasks: number }> {
    const campaign = await this.prisma.attestationCampaign.findUnique({
      where: { id: campaignId },
      select: {
        id: true,
        name: true,
        status: true,
        targetKind: true,
        targetParams: true,
        documents: { select: { id: true, documentId: true, versionId: true } },
      },
    })
    if (!campaign) throw new NotFoundException('Kampanye attestation tidak ditemukan.')
    if (campaign.status !== 'DRAF') {
      throw new ConflictException('Hanya kampanye berstatus Draf yang dapat diluncurkan.')
    }
    if (campaign.documents.length === 0) {
      throw new ConflictException('Kampanye tidak mencakup dokumen apa pun.')
    }

    const employeeIds = await this.resolveTargets(
      campaign.targetKind,
      (campaign.targetParams ?? {}) as Record<string, unknown>,
    )
    if (employeeIds.length === 0) {
      // A campaign with no targets would report 100% complete on day one, which
      // is a worse outcome than refusing: it produces evidence of compliance
      // that nobody actually demonstrated.
      throw new ConflictException(
        'Kriteria sasaran tidak menghasilkan satu karyawan pun. Kampanye tanpa sasaran akan melaporkan 100% selesai tanpa siapa pun membaca apa pun.',
      )
    }

    let created = 0
    await this.uow.write(async (tx, audit) => {
      for (const campaignDocument of campaign.documents) {
        for (const employeeId of employeeIds) {
          await tx.attestationTask.create({
            data: {
              id: randomUUID(),
              campaignId,
              campaignDocumentId: campaignDocument.id,
              employeeId,
              status: 'MENUNGGU',
            },
          })
          created += 1
        }
      }
      await tx.attestationCampaign.update({
        where: { id: campaignId },
        data: { status: 'BERJALAN', launchedAt: new Date() },
      })
      await audit.record({
        action: 'LUNCURKAN_KAMPANYE_ATTESTATION',
        objectType: 'ATTESTATION_CAMPAIGN',
        objectId: campaignId,
        after: {
          employees: employeeIds.length,
          documents: campaign.documents.length,
          tasks: created,
        },
      })
    })

    return { tasks: created }
  }

  /**
   * FR-C-020 · record a statement.
   *
   * The dwell-time and scroll checks happen here, on the server, because the
   * client-side gate is a courtesy rather than a control.
   */
  async attest(
    principal: Principal,
    taskId: string,
    evidence: { secondsViewed: number; reachedEnd: boolean; ipAddress: string | null },
  ): Promise<{ id: string }> {
    if (!principal.employeeId) {
      throw new ForbiddenException('Hanya karyawan yang dapat menyatakan telah membaca.')
    }

    const task = await this.prisma.attestationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        status: true,
        employeeId: true,
        campaignId: true,
        campaignDocument: {
          select: {
            versionId: true,
            documentId: true,
            version: { select: { id: true, body: true, extractedText: true } },
          },
        },
      },
    })
    // 404, not 403: the task names a document whose existence may be
    // confidential (kode aturan #3).
    if (!task) throw new NotFoundException('Tugas attestation tidak ditemukan.')
    // Nobody attests on someone else's behalf. An attestation is a personal
    // statement, and delegation of it would make the record meaningless.
    if (task.employeeId !== principal.employeeId) {
      throw new NotFoundException('Tugas attestation tidak ditemukan.')
    }
    if (task.status === 'SELESAI') {
      throw new ConflictException('Anda sudah menyatakan telah membaca dokumen ini.')
    }
    if (task.status === 'DIBATALKAN') {
      throw new ConflictException('Tugas ini sudah dibatalkan.')
    }

    if (evidence.secondsViewed < AttestationService.MIN_SECONDS_VIEWED) {
      throw new BadRequestException(
        'Pernyataan ditolak: dokumen belum benar-benar dibuka. Buka dan baca dokumennya terlebih dahulu.',
      )
    }

    const text = task.campaignDocument.version.body ?? task.campaignDocument.version.extractedText ?? ''
    const isLong = text.split('\n').length > AttestationService.LONG_DOCUMENT_LINES
    if (isLong && !evidence.reachedEnd) {
      throw new BadRequestException(
        'Dokumen ini panjang; gulir sampai bagian akhir sebelum menyatakan telah membaca.',
      )
    }

    const id = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.attestationRecord.create({
        data: {
          id,
          taskId,
          employeeId: principal.employeeId!,
          documentVersionId: task.campaignDocument.versionId,
          secondsViewed: evidence.secondsViewed,
          reachedEnd: evidence.reachedEnd,
          ipAddress: evidence.ipAddress,
        },
      })
      await tx.attestationTask.update({ where: { id: taskId }, data: { status: 'SELESAI' } })
      await audit.record({
        action: 'NYATAKAN_TELAH_MEMBACA',
        objectType: 'DOCUMENT',
        objectId: task.campaignDocument.documentId,
        after: {
          campaign_id: task.campaignId,
          version_id: task.campaignDocument.versionId,
          seconds_viewed: evidence.secondsViewed,
          reached_end: evidence.reachedEnd,
        },
      })
    })

    return { id }
  }

  /**
   * FR-C-019 aturan 2 · a covered document was superseded mid-campaign.
   *
   * Detection is separate from the decision. The system flags the change; a
   * human decides whether people must read it again, because only a person can
   * judge whether the revision altered anything they need to know.
   */
  async detectSupersededDocuments(campaignId: string) {
    const entries = await this.prisma.attestationCampaignDocument.findMany({
      where: { campaignId, supersededNoticedAt: null },
      select: {
        id: true,
        versionId: true,
        document: {
          select: {
            id: true,
            title: true,
            versions: {
              where: { status: 'BERLAKU' },
              select: { id: true, versionMajor: true, versionMinor: true },
            },
          },
        },
      },
    })

    const changed = entries.filter(
      (e) => e.document.versions[0] !== undefined && e.document.versions[0].id !== e.versionId,
    )
    if (changed.length === 0) return []

    await this.prisma.attestationCampaignDocument.updateMany({
      where: { id: { in: changed.map((c) => c.id) } },
      data: { supersededNoticedAt: new Date() },
    })

    return changed.map((c) => ({
      campaign_document_id: c.id,
      document_id: c.document.id,
      title: c.document.title,
      attested_version_id: c.versionId,
      current_version: `${c.document.versions[0]!.versionMajor}.${c.document.versions[0]!.versionMinor}`,
    }))
  }

  /** FR-C-019 aturan 2 · COMPLIANCE decides whether targets must re-attest. */
  async decideReattestation(
    principal: Principal,
    campaignDocumentId: string,
    required: boolean,
  ): Promise<{ reopened: number }> {
    const entry = await this.prisma.attestationCampaignDocument.findUnique({
      where: { id: campaignDocumentId },
      select: { id: true, campaignId: true, documentId: true, supersededNoticedAt: true },
    })
    if (!entry) throw new NotFoundException('Dokumen kampanye tidak ditemukan.')
    if (!entry.supersededNoticedAt) {
      throw new ConflictException(
        'Dokumen ini belum terdeteksi berganti versi; belum ada yang perlu diputuskan.',
      )
    }

    let reopened = 0
    await this.uow.write(async (tx, audit) => {
      if (required) {
        // Only completed tasks reopen. Someone still outstanding will read the
        // new version anyway, and resetting them would lose nothing but muddy
        // the count.
        const result = await tx.attestationTask.updateMany({
          where: { campaignDocumentId, status: 'SELESAI' },
          data: { status: 'PERLU_NYATAKAN_ULANG' },
        })
        reopened = result.count

        // The obligation now points at the new text, so the pinned version
        // moves forward. The earlier attestation records keep naming the older
        // version, which is what preserves the fact that people read different
        // text at different times.
        const current = await tx.documentVersion.findFirst({
          where: { documentId: entry.documentId, status: 'BERLAKU' },
          select: { id: true },
        })
        if (current) {
          await tx.attestationCampaignDocument.update({
            where: { id: campaignDocumentId },
            data: { versionId: current.id },
          })
        }
      }

      await tx.attestationCampaignDocument.update({
        where: { id: campaignDocumentId },
        data: {
          reattestationRequired: required,
          reattestationDecidedAt: new Date(),
          reattestationDecidedBy: principal.userId,
        },
      })

      await audit.record({
        action: 'PUTUSKAN_PERNYATAAN_ULANG',
        objectType: 'ATTESTATION_CAMPAIGN',
        objectId: entry.campaignId,
        after: { campaign_document_id: campaignDocumentId, required, reopened },
      })
    })

    return { reopened }
  }

  /**
   * FR-C-021 aturan 1 · completion overall, per unit, and per job title.
   *
   * Counts come from tasks, so people who have not acted are counted rather
   * than being invisible. A percentage computed from attestations alone would
   * always read 100%.
   */
  async progress(campaignId: string) {
    const campaign = await this.prisma.attestationCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, status: true, startDate: true, dueDate: true },
    })
    if (!campaign) throw new NotFoundException('Kampanye attestation tidak ditemukan.')

    const rows = await this.prisma.attestationTask.findMany({
      where: { campaignId },
      select: {
        status: true,
        employee: {
          select: { jobTitle: true, orgUnit: { select: { code: true, name: true } } },
        },
      },
    })

    const overall = { total: rows.length, done: 0, outstanding: 0 }
    const byUnit = new Map<string, { name: string; total: number; done: number }>()
    const byJobTitle = new Map<string, { total: number; done: number }>()

    for (const row of rows) {
      const done = row.status === 'SELESAI'
      if (done) overall.done += 1
      else if (row.status !== 'DIBATALKAN') overall.outstanding += 1

      const unitKey = row.employee.orgUnit.code
      const unit = byUnit.get(unitKey) ?? { name: row.employee.orgUnit.name, total: 0, done: 0 }
      unit.total += 1
      if (done) unit.done += 1
      byUnit.set(unitKey, unit)

      const job = byJobTitle.get(row.employee.jobTitle) ?? { total: 0, done: 0 }
      job.total += 1
      if (done) job.done += 1
      byJobTitle.set(row.employee.jobTitle, job)
    }

    return {
      campaign,
      overall: { ...overall, percent: percent(overall.done, overall.total) },
      by_unit: [...byUnit.entries()].map(([code, v]) => ({
        code,
        name: v.name,
        total: v.total,
        done: v.done,
        percent: percent(v.done, v.total),
      })),
      by_job_title: [...byJobTitle.entries()].map(([jobTitle, v]) => ({
        job_title: jobTitle,
        total: v.total,
        done: v.done,
        percent: percent(v.done, v.total),
      })),
    }
  }

  /** The attestations still owed by the signed-in person. */
  async myTasks(principal: Principal) {
    if (!principal.employeeId) return []
    return this.prisma.attestationTask.findMany({
      where: {
        employeeId: principal.employeeId,
        status: { in: ['MENUNGGU', 'PERLU_NYATAKAN_ULANG'] },
        campaign: { status: 'BERJALAN' },
      },
      select: {
        id: true,
        status: true,
        campaign: { select: { id: true, name: true, dueDate: true, isMandatory: true } },
        campaignDocument: {
          select: {
            versionId: true,
            document: { select: { id: true, documentNo: true, title: true, documentType: true } },
            version: { select: { versionMajor: true, versionMinor: true } },
          },
        },
      },
      orderBy: { campaign: { dueDate: 'asc' } },
      take: 200,
    })
  }

  /**
   * FR-C-021 aturan 2 & FR-A-014 aturan 2 · turn the completion report into
   * Modul A evidence.
   *
   * The same bridge Modul B builds for campaign packs, for the same reason: an
   * auditor testing "are staff aware of the policies that bind them" needs a
   * frozen artefact, not a dashboard that shows a different number every time
   * it is opened. So the counts are snapshotted into the evidence at generation
   * time and never recomputed on read.
   *
   * Closing the campaign is part of generating the report, not a separate step.
   * A report generated from a campaign that then keeps accepting attestations
   * would be evidence of a number that no longer holds.
   */
  async generateEvidence(principal: Principal, campaignId: string): Promise<{ evidenceId: string }> {
    const campaign = await this.prisma.attestationCampaign.findUnique({
      where: { id: campaignId },
      select: { id: true, name: true, status: true, startDate: true, dueDate: true },
    })
    if (!campaign) throw new NotFoundException('Kampanye attestation tidak ditemukan.')
    if (campaign.status !== 'BERJALAN') {
      throw new ConflictException(
        'Hanya kampanye berjalan yang dapat dijadikan bukti; kampanye ini sudah selesai atau dibatalkan.',
      )
    }

    const report = await this.progress(campaignId)
    const documents = await this.prisma.attestationCampaignDocument.findMany({
      where: { campaignId },
      select: {
        document: { select: { documentNo: true, title: true } },
        version: { select: { versionMajor: true, versionMinor: true } },
        reattestationRequired: true,
      },
    })

    const evidenceId = randomUUID()
    await this.uow.write(async (tx, audit) => {
      await tx.evidence.create({
        data: {
          id: evidenceId,
          title: `Laporan attestation kebijakan — ${campaign.name}`,
          description:
            `Laporan penyelesaian pernyataan telah membaca (FR-C-021), dibangkitkan sistem. ` +
            `${report.overall.done} dari ${report.overall.total} kewajiban terpenuhi ` +
            `(${report.overall.percent}%).`,
          evidenceType: 'LAPORAN_ATTESTATION',
          validityFrom: campaign.startDate,
          validityTo: campaign.dueDate,
          ownerOrgUnitId: null,
          // Who read which policy is ordinary internal governance data, not a
          // secret: classifying it higher would put it out of reach of the
          // auditors it exists for.
          classification: 'INTERNAL',
          source: 'DIBANGKITKAN_SISTEM',
          // FR-A-014 aturan 4 · system-generated evidence is not user-editable.
          systemGenerated: true,
          status: 'DITERIMA',
          currentVersionNo: 0,
          createdBy: principal.userId,
        },
      })

      await tx.evidenceLink.create({
        data: {
          id: randomUUID(),
          evidenceId,
          targetType: 'ATTESTATION_CAMPAIGN',
          targetId: campaignId,
          note: 'Tautan otomatis laporan attestation ke kampanye asalnya (FR-C-021 aturan 2).',
          linkedBy: principal.userId,
        },
      })

      await tx.attestationCampaign.update({
        where: { id: campaignId },
        data: { status: 'SELESAI', closedAt: new Date() },
      })

      await audit.record({
        action: 'BANGKITKAN_BUKTI_ATTESTATION',
        objectType: 'ATTESTATION_CAMPAIGN',
        objectId: campaignId,
        after: {
          evidence_id: evidenceId,
          total: report.overall.total,
          done: report.overall.done,
          percent: report.overall.percent,
          documents: documents.map((d) => ({
            document_no: d.document.documentNo,
            title: d.document.title,
            version: `${d.version.versionMajor}.${d.version.versionMinor}`,
            reattestation_required: d.reattestationRequired,
          })),
        },
      })
    })

    return { evidenceId }
  }

  async list(_principal: Principal) {
    return this.prisma.attestationCampaign.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        startDate: true,
        dueDate: true,
        isMandatory: true,
        _count: { select: { tasks: true, documents: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
  }

  /* ----------------------------------------------------------- internals --- */

  /**
   * FR-C-019 · resolve the target criteria into concrete employees.
   *
   * Only active employees. Someone who has left cannot read a policy, and
   * counting them as outstanding would permanently hold the campaign below
   * 100% for a reason that has nothing to do with compliance.
   */
  private async resolveTargets(
    kind: AttestationTargetKind,
    params: Record<string, unknown>,
  ): Promise<string[]> {
    const active = { employmentStatus: 'AKTIF' as const }

    switch (kind) {
      case 'SELURUH_KARYAWAN': {
        const rows = await this.prisma.employee.findMany({
          where: active,
          select: { id: true },
        })
        return rows.map((r) => r.id)
      }
      case 'UNIT': {
        const unitIds = asStringArray(params.org_unit_ids)
        const rows = await this.prisma.employee.findMany({
          where: { ...active, orgUnitId: { in: unitIds } },
          select: { id: true },
        })
        return rows.map((r) => r.id)
      }
      case 'JABATAN': {
        const titles = asStringArray(params.job_titles)
        const rows = await this.prisma.employee.findMany({
          where: { ...active, jobTitle: { in: titles } },
          select: { id: true },
        })
        return rows.map((r) => r.id)
      }
      case 'KARYAWAN_BARU': {
        const since = new Date(String(params.joined_since))
        const rows = await this.prisma.employee.findMany({
          where: { ...active, joinedAt: { gte: since } },
          select: { id: true },
        })
        return rows.map((r) => r.id)
      }
      case 'DAFTAR_INDIVIDU': {
        const employeeIds = asStringArray(params.employee_ids)
        const rows = await this.prisma.employee.findMany({
          where: { ...active, id: { in: employeeIds } },
          select: { id: true },
        })
        return rows.map((r) => r.id)
      }
    }
  }

  /** Reject a target rule whose parameters cannot produce anyone. */
  private assertTargetParams(kind: AttestationTargetKind, params: Record<string, unknown>): void {
    switch (kind) {
      case 'SELURUH_KARYAWAN':
        return
      case 'UNIT':
        if (asStringArray(params.org_unit_ids).length === 0) {
          throw new BadRequestException('Sasaran unit memerlukan "org_unit_ids".')
        }
        return
      case 'JABATAN':
        if (asStringArray(params.job_titles).length === 0) {
          throw new BadRequestException('Sasaran jabatan memerlukan "job_titles".')
        }
        return
      case 'KARYAWAN_BARU':
        if (!params.joined_since || Number.isNaN(new Date(String(params.joined_since)).getTime())) {
          throw new BadRequestException('Sasaran karyawan baru memerlukan "joined_since" (tanggal).')
        }
        return
      case 'DAFTAR_INDIVIDU':
        if (asStringArray(params.employee_ids).length === 0) {
          throw new BadRequestException('Sasaran daftar individu memerlukan "employee_ids".')
        }
        return
    }
  }
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/**
 * Completion as a whole percentage.
 *
 * Rounding is deliberately asymmetric at both ends. Plain `Math.round` reports
 * 1 of 250 as "0%", which reads as "nobody has started" when someone has, and
 * 249 of 250 as "100%", which reads as "done" when one person is still
 * outstanding. For a compliance figure, both are the wrong error: the first
 * hides progress, and the second -- far worse -- hides an outstanding
 * obligation behind a number that says there are none.
 *
 * So any progress at all floors at 1%, and only genuinely complete floors at
 * 100%.
 */
function percent(done: number, total: number): number {
  if (total === 0) return 0
  if (done === 0) return 0
  if (done >= total) return 100
  const raw = Math.round((done / total) * 100)
  if (raw === 0) return 1
  if (raw === 100) return 99
  return raw
}

export { type TransactionClient }
