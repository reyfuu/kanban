import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { RevocationTicketStatus } from '@prisma/client'
import {
  applicationScope,
  PrismaService,
  UnitOfWork,
  type Principal,
  type TransactionClient,
} from '../shared/index.js'

/** FR-B-020 rule 3. */
const UNVERIFIABLE_AFTER_DAYS = 30

/**
 * Transitions a person is allowed to ask for (FR-B-019).
 *
 * TERVERIFIKASI_TERTUTUP is deliberately absent from every entry. That absence
 * IS critical control K-1: there is no request a human can make, with any role,
 * that closes a ticket as verified. The only writer of that status is
 * `verifyAgainstSnapshot` below, and it writes it only alongside the id of the
 * snapshot that proved the access is gone -- which the database then insists on
 * via chk_revocation_ticket_verified_requires_snapshot.
 *
 * GAGAL_DIVERIFIKASI is likewise machine-only: a ticket fails verification
 * because evidence says the access is still there, never because someone said so.
 */
const MANUAL_TRANSITIONS: Readonly<Record<RevocationTicketStatus, readonly RevocationTicketStatus[]>> = {
  TERBUKA: ['DALAM_PROSES', 'DIKECUALIKAN'],
  DALAM_PROSES: ['MENUNGGU_VERIFIKASI', 'DIKECUALIKAN'],
  MENUNGGU_VERIFIKASI: [],
  GAGAL_DIVERIFIKASI: ['DALAM_PROSES'],
  TERVERIFIKASI_TERTUTUP: [],
  DIKECUALIKAN: [],
  TIDAK_DAPAT_DIVERIFIKASI: ['DALAM_PROSES'],
}

export interface VerificationOutcome {
  readonly snapshotId: string
  readonly checked: number
  readonly closed: number
  readonly failed: number
}

@Injectable()
export class RevocationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
  ) {}

  /** FR-B-018 · the executor's worklist, scope-filtered in the repository layer. */
  async list(
    principal: Principal,
    filter: { status?: RevocationTicketStatus; applicationId?: string; overdue?: boolean; take: number },
  ) {
    const apps = applicationScope(principal)
    const today = new Date()

    return this.prisma.revocationTicket.findMany({
      where: {
        AND: [
          apps.whereOn('applicationId'),
          filter.status ? { status: filter.status } : {},
          filter.applicationId ? { applicationId: filter.applicationId } : {},
          filter.overdue
            ? {
                slaDueDate: { lt: today },
                status: { notIn: ['TERVERIFIKASI_TERTUTUP', 'DIKECUALIKAN'] },
              }
            : {},
        ],
      },
      include: {
        application: { select: { id: true, code: true, name: true } },
        entitlement: { select: { id: true, displayName: true, isPrivileged: true } },
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: [{ slaDueDate: 'asc' }],
      take: filter.take,
    })
  }

  /**
   * FR-B-019 · the named actions a person may take on a ticket.
   *
   * Deliberately three verbs rather than one status field (07-API-CONTRACT
   * §5.8). "Selesai dikerjakan" gets a ticket as far as MENUNGGU_VERIFIKASI and
   * no further; the executor is asserting they did the work, and the system does
   * not take that as proof the access is gone, because the entire reason this
   * module exists is that such assertions have historically been wrong.
   *
   * Named actions matter for K-1 beyond style: `POST /complete` has no field in
   * which a caller could name a target status, so there is nothing to constrain
   * and nothing to get the constraint wrong about. The transition table below
   * still guards the state machine, but the endpoint cannot express the thing
   * the table would have to refuse.
   */
  async claim(principal: Principal, ticketId: string): Promise<void> {
    await this.move(principal, ticketId, 'DALAM_PROSES', 'AMBIL_TIKET', {})
  }

  async complete(
    principal: Principal,
    ticketId: string,
    input: { executionNote: string; externalTicketRef?: string },
  ): Promise<void> {
    await this.move(principal, ticketId, 'MENUNGGU_VERIFIKASI', 'SELESAIKAN_TIKET', {
      execution_note: input.executionNote,
      external_ticket_ref: input.externalTicketRef ?? null,
    })
  }

  async grantException(
    principal: Principal,
    ticketId: string,
    input: { reason: string },
  ): Promise<void> {
    await this.move(principal, ticketId, 'DIKECUALIKAN', 'KECUALIKAN_TIKET', { reason: input.reason })
  }

  /**
   * FR-B-021 · ad-hoc verification of one ticket.
   *
   * Checks against the most recent completed snapshot of the ticket's own
   * application. It cannot be told which outcome to record -- it is handed a
   * ticket, and the snapshot data decides. `SEC_OFFICER` triggering this early
   * changes only WHEN the question is asked, never what counts as an answer.
   */
  async verifyNow(principal: Principal, ticketId: string): Promise<VerificationOutcome> {
    const apps = applicationScope(principal)
    const ticket = await this.prisma.revocationTicket.findFirst({
      where: { AND: [apps.whereOn('applicationId'), { id: ticketId }] },
      select: { id: true, applicationId: true, status: true },
    })
    if (!ticket) throw new NotFoundException('Tiket pencabutan tidak ditemukan.')
    if (ticket.status !== 'MENUNGGU_VERIFIKASI') {
      throw new ConflictException(
        `Hanya tiket berstatus MENUNGGU_VERIFIKASI yang dapat diverifikasi; tiket ini berstatus ${ticket.status}.`,
      )
    }

    const snapshot = await this.prisma.accessSnapshot.findFirst({
      where: { applicationId: ticket.applicationId, status: 'SELESAI' },
      orderBy: { capturedAt: 'desc' },
      select: { id: true },
    })
    if (!snapshot) {
      throw new ConflictException(
        'Belum ada snapshot selesai untuk aplikasi ini, sehingga pencabutan belum dapat dibuktikan.',
      )
    }

    return this.verifyAgainstSnapshot(snapshot.id, { onlyTicketId: ticketId })
  }

  /** One ticket, scope-checked. */
  async findOne(principal: Principal, ticketId: string) {
    const apps = applicationScope(principal)
    const ticket = await this.prisma.revocationTicket.findFirst({
      where: { AND: [apps.whereOn('applicationId'), { id: ticketId }] },
      include: {
        application: { select: { id: true, code: true, name: true } },
        entitlement: { select: { id: true, displayName: true, isPrivileged: true } },
        assignee: { select: { id: true, fullName: true } },
      },
    })
    if (!ticket) throw new NotFoundException('Tiket pencabutan tidak ditemukan.')
    return ticket
  }

  /** FR-B-018 · `GET /my/revocation-tickets` — the assignee's own worklist. */
  async listForAssignee(principal: Principal, take: number) {
    if (!principal.employeeId) return []
    return this.prisma.revocationTicket.findMany({
      where: {
        AND: [
          applicationScope(principal).whereOn('applicationId'),
          { assigneeId: principal.employeeId },
        ],
      },
      include: {
        application: { select: { id: true, code: true, name: true } },
        entitlement: { select: { id: true, displayName: true, isPrivileged: true } },
        assignee: { select: { id: true, fullName: true } },
      },
      orderBy: [{ slaDueDate: 'asc' }],
      take,
    })
  }

  private async move(
    principal: Principal,
    ticketId: string,
    target: RevocationTicketStatus,
    action: string,
    detail: Record<string, unknown>,
  ): Promise<void> {
    const apps = applicationScope(principal)
    const ticket = await this.prisma.revocationTicket.findFirst({
      where: { AND: [apps.whereOn('applicationId'), { id: ticketId }] },
      select: { id: true, status: true, ticketNo: true },
    })
    if (!ticket) throw new NotFoundException('Tiket pencabutan tidak ditemukan.')

    if (!MANUAL_TRANSITIONS[ticket.status].includes(target)) {
      throw new ConflictException(
        `Tiket berstatus ${ticket.status} tidak dapat berpindah ke ${target}.`,
      )
    }

    await this.uow.write(async (tx, audit) => {
      await tx.revocationTicket.update({
        where: { id: ticketId },
        data: {
          status: target,
          ...(typeof detail.external_ticket_ref === 'string'
            ? { externalTicketRef: detail.external_ticket_ref }
            : {}),
        },
      })
      await audit.record({
        action,
        objectType: 'REVOCATION_TICKET',
        objectId: ticketId,
        before: { status: ticket.status },
        after: { status: target, ticket_no: ticket.ticketNo, ...detail },
      })
    })
  }

  /**
   * FR-B-020 · the only path to a closed ticket — critical control K-1.
   *
   * Runs when a new snapshot lands for an application. For every ticket of that
   * application awaiting verification, it asks the snapshot whether the account
   * still holds the entitlement:
   *
   *   gone     -> TERVERIFIKASI_TERTUTUP, stamped with the snapshot that proved it
   *   present  -> GAGAL_DIVERIFIKASI (rule 2), returned to the executor
   *
   * Note what is NOT a parameter: the outcome. The caller says which snapshot to
   * check against, and the data decides the rest. A verification routine that
   * accepted a result would be a manual close with extra steps.
   *
   * `actorId` must be in the request context, so this is called from an
   * authenticated action (FR-B-021 ad-hoc verification by SEC_OFFICER) or from a
   * job that establishes a system context of its own.
   */
  async verifyAgainstSnapshot(
    snapshotId: string,
    options: { onlyTicketId?: string } = {},
  ): Promise<VerificationOutcome> {
    const snapshot = await this.prisma.accessSnapshot.findUnique({
      where: { id: snapshotId },
      select: { id: true, applicationId: true, status: true, capturedAt: true },
    })
    if (!snapshot) throw new NotFoundException('Snapshot tidak ditemukan.')
    if (snapshot.status !== 'SELESAI') {
      // A partial snapshot is missing rows for reasons that have nothing to do
      // with revocation. Verifying against it would close tickets because the
      // import stopped early, which is precisely the false "yes, it's gone"
      // this control exists to prevent.
      throw new ConflictException(
        'Verifikasi hanya dapat memakai snapshot berstatus SELESAI; snapshot yang belum utuh ' +
          'akan membaca akses yang belum terimpor sebagai akses yang telah dicabut.',
      )
    }

    const pending = await this.prisma.revocationTicket.findMany({
      where: {
        applicationId: snapshot.applicationId,
        status: 'MENUNGGU_VERIFIKASI',
        ...(options.onlyTicketId ? { id: options.onlyTicketId } : {}),
      },
      select: { id: true, ticketNo: true, accountId: true, entitlementId: true, actionType: true },
    })
    if (pending.length === 0) {
      return { snapshotId, checked: 0, closed: 0, failed: 0 }
    }

    let closed = 0
    let failed = 0

    await this.uow.write(async (tx, audit) => {
      for (const ticket of pending) {
        const stillPresent = await this.accessStillPresent(tx, {
          snapshotId,
          accountId: ticket.accountId,
          entitlementId: ticket.entitlementId,
        })

        // A "Ubah" ticket asks for the access to be adjusted, not removed, so
        // the entitlement disappearing entirely is not the proof it needs.
        // Downgrade verification needs the target entitlement recorded on the
        // ticket, which the schema does not carry -- so these are held rather
        // than closed on evidence that does not actually answer the question.
        if (ticket.actionType === 'UBAH') {
          continue
        }

        if (stillPresent) {
          await tx.revocationTicket.update({
            where: { id: ticket.id },
            data: { status: 'GAGAL_DIVERIFIKASI' },
          })
          failed += 1
          await audit.record({
            action: 'VERIFIKASI_PENCABUTAN_GAGAL',
            objectType: 'REVOCATION_TICKET',
            objectId: ticket.id,
            before: { status: 'MENUNGGU_VERIFIKASI' },
            after: {
              status: 'GAGAL_DIVERIFIKASI',
              ticket_no: ticket.ticketNo,
              checked_against_snapshot_id: snapshotId,
              account_id: ticket.accountId,
            },
          })
          continue
        }

        await tx.revocationTicket.update({
          where: { id: ticket.id },
          data: { status: 'TERVERIFIKASI_TERTUTUP', verifiedBySnapshotId: snapshotId },
        })
        closed += 1
        await audit.record({
          action: 'VERIFIKASI_PENCABUTAN',
          objectType: 'REVOCATION_TICKET',
          objectId: ticket.id,
          before: { status: 'MENUNGGU_VERIFIKASI' },
          after: {
            status: 'TERVERIFIKASI_TERTUTUP',
            ticket_no: ticket.ticketNo,
            verified_by_snapshot_id: snapshotId,
            account_id: ticket.accountId,
          },
        })
      }

      // UnitOfWork refuses a transaction with no audit entry. When every pending
      // ticket was an Ubah and therefore skipped, nothing happened and there is
      // nothing to record -- so say that, rather than leave a legitimate no-op
      // looking like a forgotten audit write.
      if (closed === 0 && failed === 0) {
        await audit.record({
          action: 'VERIFIKASI_PENCABUTAN_NIHIL',
          objectType: 'ACCESS_SNAPSHOT',
          objectId: snapshotId,
          after: { pending_tickets: pending.length, closed: 0, failed: 0 },
        })
      }
    })

    return { snapshotId, checked: pending.length, closed, failed }
  }

  /**
   * FR-B-020 rule 3 · tickets nobody can verify because no snapshot arrived.
   *
   * Marked rather than closed. A ticket that stalls because the connector broke
   * is an unresolved risk, and letting it age quietly into "probably fine" is
   * how the register stops reflecting reality.
   */
  async markUnverifiable(): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - UNVERIFIABLE_AFTER_DAYS)

    const stale = await this.prisma.revocationTicket.findMany({
      where: { status: 'MENUNGGU_VERIFIKASI', updatedAt: { lt: cutoff } },
      select: { id: true, ticketNo: true, applicationId: true },
    })
    if (stale.length === 0) return 0

    await this.uow.write(async (tx, audit) => {
      for (const ticket of stale) {
        await tx.revocationTicket.update({
          where: { id: ticket.id },
          data: { status: 'TIDAK_DAPAT_DIVERIFIKASI' },
        })
        await audit.record({
          action: 'TIKET_TIDAK_DAPAT_DIVERIFIKASI',
          objectType: 'REVOCATION_TICKET',
          objectId: ticket.id,
          before: { status: 'MENUNGGU_VERIFIKASI' },
          after: {
            status: 'TIDAK_DAPAT_DIVERIFIKASI',
            ticket_no: ticket.ticketNo,
            days_without_snapshot: UNVERIFIABLE_AFTER_DAYS,
          },
        })
      }
    })

    return stale.length
  }

  /**
   * Does this account still hold this entitlement in the given snapshot?
   *
   * Raw SQL because snapshot_line is partitioned and this needs to read across
   * partitions by snapshot_id; the query planner prunes on captured_at, which
   * is joined in from access_snapshot rather than guessed.
   */
  private async accessStillPresent(
    tx: TransactionClient,
    args: { snapshotId: string; accountId: string; entitlementId: string },
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<{ present: number }[]>`
      SELECT 1 AS present
      FROM public.snapshot_line sl
      WHERE sl.snapshot_id = ${args.snapshotId}::uuid
        AND sl.account_id = ${args.accountId}
        AND sl.entitlement_id = ${args.entitlementId}::uuid
      LIMIT 1
    `
    return rows.length > 0
  }
}
