import { Injectable, NotFoundException } from '@nestjs/common'
import { applicationScope, PrismaService, type Principal } from '../shared/index.js'

/** Keeps one page of lines from becoming a whole snapshot on the wire. */
const MAX_LINE_PAGE = 200

export type SnapshotChangeType = 'DITAMBAH' | 'DIHAPUS' | 'DIUBAH'

/**
 * Reading snapshots (FR-B-005).
 *
 * Read-only by construction: there is no method here that writes, because
 * FR-B-005 aturan 2 says a snapshot is corrected by capturing again, never by
 * editing. The write path is SnapshotUploadService, and it only inserts.
 *
 * Every query is scope-filtered at this layer rather than in the controller
 * (CLAUDE.md rule 1). A snapshot names who holds what inside an application;
 * an application owner with scope over one system must not be able to read
 * another system's holdings by guessing a snapshot id.
 */
@Injectable()
export class SnapshotService {
  constructor(private readonly prisma: PrismaService) {}

  /** FR-B-005 aturan 3 · the capture history of one application. */
  async listForApplication(principal: Principal, applicationId: string) {
    await this.requireApplication(principal, applicationId)

    const snapshots = await this.prisma.accessSnapshot.findMany({
      where: { applicationId },
      orderBy: { capturedAt: 'desc' },
      take: 50,
      include: {
        capturedByUser: { select: { employee: { select: { fullName: true } } } },
      },
    })

    return snapshots.map((s) => ({
      id: s.id,
      captured_at: s.capturedAt.toISOString(),
      source: s.source,
      status: s.status,
      identity_count: s.identityCount,
      entitlement_count: s.entitlementCount,
      content_hash: s.contentHash,
      captured_by: s.capturedByUser?.employee?.fullName ?? null,
    }))
  }

  async findOne(principal: Principal, snapshotId: string) {
    const snapshot = await this.requireSnapshot(principal, snapshotId)

    const unowned = await this.prisma.snapshotLine.count({
      where: { snapshotId, employeeId: null },
    })

    return {
      id: snapshot.id,
      application: { id: snapshot.application.id, code: snapshot.application.code, name: snapshot.application.name },
      captured_at: snapshot.capturedAt.toISOString(),
      source: snapshot.source,
      status: snapshot.status,
      identity_count: snapshot.identityCount,
      entitlement_count: snapshot.entitlementCount,
      content_hash: snapshot.contentHash,
      captured_by: snapshot.capturedByUser?.employee?.fullName ?? null,
      // FR-B-006 aturan 4 surfaced where it is actionable. Zero is worth
      // showing too: it is the evidence that the mapping ran, not that it was
      // skipped.
      unowned_account_count: unowned,
    }
  }

  async listLines(
    principal: Principal,
    snapshotId: string,
    filter: { q?: string; entitlementId?: string; employeeId?: string; take?: number },
  ) {
    await this.requireSnapshot(principal, snapshotId)

    const q = filter.q?.trim()
    const lines = await this.prisma.snapshotLine.findMany({
      where: {
        snapshotId,
        ...(filter.entitlementId ? { entitlementId: filter.entitlementId } : {}),
        ...(filter.employeeId ? { employeeId: filter.employeeId } : {}),
        ...(q
          ? {
              OR: [
                { accountId: { contains: q, mode: 'insensitive' as const } },
                { accountName: { contains: q, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      },
      orderBy: [{ accountId: 'asc' }],
      take: Math.min(filter.take ?? MAX_LINE_PAGE, MAX_LINE_PAGE),
      include: {
        entitlement: { select: { technicalCode: true, displayName: true, riskLevel: true, isPrivileged: true } },
        employee: { select: { id: true, fullName: true, employeeNumber: true, employmentStatus: true } },
      },
    })

    return lines.map((line) => ({
      id: line.id,
      account_id: line.accountId,
      account_name: line.accountName,
      account_status: line.accountStatus,
      entitlement: {
        code: line.entitlement.technicalCode,
        display_name: line.entitlement.displayName,
        risk_level: line.entitlement.riskLevel,
        is_privileged: line.entitlement.isPrivileged,
      },
      employee: line.employee
        ? {
            id: line.employee.id,
            full_name: line.employee.fullName,
            employee_number: line.employee.employeeNumber,
            employment_status: line.employee.employmentStatus,
          }
        : null,
      last_access_at: line.lastAccessAt?.toISOString() ?? null,
      granted_at: line.grantedAt?.toISOString().slice(0, 10) ?? null,
      granted_by: line.grantedBy,
    }))
  }

  /**
   * FR-B-005 aturan 4 · what changed between two captures.
   *
   * The unit of comparison is (account, entitlement) — one line of access —
   * rather than the row id, because line ids are new on every capture and
   * comparing them would report every row as removed and re-added. `DIUBAH`
   * means the same access with a different account status, which is the
   * difference that matters for review: an entitlement still held by a
   * disabled account is not the same finding as one held by a live account.
   *
   * Both snapshots are scope-checked separately. They belong to the same
   * application in practice, but "in practice" is not a control.
   */
  async compare(principal: Principal, fromId: string, toId: string) {
    const [from, to] = await Promise.all([
      this.requireSnapshot(principal, fromId),
      this.requireSnapshot(principal, toId),
    ])

    const [fromLines, toLines] = await Promise.all([
      this.linesForCompare(fromId),
      this.linesForCompare(toId),
    ])

    const fromIndex = new Map(fromLines.map((l) => [key(l), l]))
    const toIndex = new Map(toLines.map((l) => [key(l), l]))

    const changes: {
      type: SnapshotChangeType
      account_id: string
      employee: { id: string; full_name: string } | null
      entitlement: { code: string; display_name: string }
      from_status: string | null
      to_status: string | null
    }[] = []

    for (const line of toLines) {
      const before = fromIndex.get(key(line))
      if (!before) changes.push(change('DITAMBAH', line, null, line.accountStatus))
      else if (before.accountStatus !== line.accountStatus) {
        changes.push(change('DIUBAH', line, before.accountStatus, line.accountStatus))
      }
    }
    for (const line of fromLines) {
      if (!toIndex.has(key(line))) changes.push(change('DIHAPUS', line, line.accountStatus, null))
    }

    return {
      from: {
        id: from.id,
        captured_at: from.capturedAt.toISOString(),
        line_count: fromLines.length,
      },
      to: { id: to.id, captured_at: to.capturedAt.toISOString(), line_count: toLines.length },
      summary: {
        added: changes.filter((c) => c.type === 'DITAMBAH').length,
        removed: changes.filter((c) => c.type === 'DIHAPUS').length,
        changed: changes.filter((c) => c.type === 'DIUBAH').length,
      },
      changes,
    }
  }

  private async linesForCompare(snapshotId: string) {
    return this.prisma.snapshotLine.findMany({
      where: { snapshotId },
      select: {
        accountId: true,
        accountStatus: true,
        entitlement: { select: { technicalCode: true, displayName: true } },
        employee: { select: { id: true, fullName: true } },
      },
    })
  }

  private async requireSnapshot(principal: Principal, snapshotId: string) {
    const scope = applicationScope(principal)
    const snapshot = await this.prisma.accessSnapshot.findFirst({
      // The scope narrows the query itself, so an out-of-scope snapshot is not
      // fetched and then rejected -- it is never read.
      where: { AND: [{ id: snapshotId }, scope.whereOn('applicationId')] },
      include: {
        application: { select: { id: true, code: true, name: true } },
        capturedByUser: { select: { employee: { select: { fullName: true } } } },
      },
    })
    if (!snapshot) {
      // 404 for out-of-scope as well as absent (CLAUDE.md rule 3): a 403 would
      // confirm that a snapshot with this id exists on an application the
      // caller may not see.
      throw new NotFoundException('Snapshot tidak ditemukan.')
    }
    return snapshot
  }

  private async requireApplication(principal: Principal, applicationId: string) {
    const scope = applicationScope(principal)
    const application = await this.prisma.application.findFirst({
      where: { AND: [scope.whereOn('id'), { id: applicationId }] },
      select: { id: true },
    })
    if (!application) throw new NotFoundException('Aplikasi tidak ditemukan.')
    return application
  }
}

type CompareLine = {
  accountId: string
  accountStatus: string
  entitlement: { technicalCode: string; displayName: string }
  employee: { id: string; fullName: string } | null
}

function key(line: CompareLine): string {
  return `${line.accountId}|${line.entitlement.technicalCode}`
}

function change(
  type: SnapshotChangeType,
  line: CompareLine,
  fromStatus: string | null,
  toStatus: string | null,
) {
  return {
    type,
    account_id: line.accountId,
    employee: line.employee ? { id: line.employee.id, full_name: line.employee.fullName } : null,
    entitlement: { code: line.entitlement.technicalCode, display_name: line.entitlement.displayName },
    from_status: fromStatus,
    to_status: toStatus,
  }
}
