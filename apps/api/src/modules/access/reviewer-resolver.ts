import { Injectable } from '@nestjs/common'
import { PrismaService } from '../shared/index.js'

/** FR-B-009 · the configurable assignment rules. */
export type ReviewerRuleCode = 'RA-01' | 'RA-02' | 'RA-03' | 'RA-04' | 'RA-05'

export interface ReviewerRule {
  readonly code: ReviewerRuleCode
  /** RA-05 only — the manually named reviewer. */
  readonly specificReviewerUserId?: string
}

export function parseReviewerRule(value: unknown): ReviewerRule {
  const raw = (value ?? {}) as Record<string, unknown>
  const code = String(raw.code ?? raw.type ?? 'RA-02') as ReviewerRuleCode
  const specific = raw.specific_reviewer_user_id ?? raw.specificReviewerUserId
  return {
    code,
    ...(typeof specific === 'string' ? { specificReviewerUserId: specific } : {}),
  }
}

/** One (account, entitlement) pair awaiting a reviewer. */
export interface ResolvableLine {
  readonly snapshotLineId: string
  readonly employeeId: string | null
  readonly applicationId: string
  readonly isPrivileged: boolean
}

/** Where one line ended up, and why. */
export interface ResolvedAssignment {
  readonly snapshotLineId: string
  readonly layerNo: number
  readonly reviewerUserId: string
  /**
   * How the reviewer was reached. Carried through to the preview so the
   * campaign author sees WHY items landed on the fallback rather than just how
   * many did -- FR-B-009's validation exists because a high fallback count means
   * the org chart is broken, and that is only actionable if you can see which
   * people are missing a manager.
   */
  readonly via: 'RULE' | 'FALLBACK_NO_REVIEWER' | 'FALLBACK_SELF_REVIEW' | 'ESCALATED_SELF_REVIEW' | 'ESCALATED_INACTIVE'
}

interface Directory {
  /** employeeId -> appUser.id, for active users only. */
  userByEmployee: Map<string, string>
  /** employeeId -> managerId. */
  managerOf: Map<string, string | null>
  /** applicationId -> owning employeeId. */
  ownerOf: Map<string, string>
  /** appUser.id -> employeeId. */
  employeeByUser: Map<string, string>
}

/**
 * Turns snapshot lines into reviewer assignments (FR-B-009).
 *
 * Pure resolution, no writes. The preview and the launch both call this and get
 * the same answer -- which is the point: a preview that estimates differently
 * from what launch will do is worse than no preview, because the author acts on
 * numbers that will not hold.
 *
 * Three business rules sit on top of whichever rule was chosen, and they are
 * applied in this order:
 *
 *   rule 2 · nobody reviews their own access. The item escalates to their
 *            manager, and only reaches the fallback if there is no manager.
 *            This is checked AFTER the rule resolves, because every rule can
 *            produce a self-review -- an application owner holds access to
 *            their own application more often than not.
 *   rule 3 · an inactive reviewer's items go to their manager.
 *   rule 1 · anything still unresolved goes to the campaign's fallback
 *            reviewer, which the schema makes mandatory.
 */
@Injectable()
export class ReviewerResolver {
  constructor(private readonly prisma: PrismaService) {}

  async loadDirectory(applicationIds: readonly string[]): Promise<Directory> {
    const [users, employees, applications] = await Promise.all([
      this.prisma.appUser.findMany({
        where: { isActive: true, employeeId: { not: null } },
        select: { id: true, employeeId: true },
      }),
      this.prisma.employee.findMany({ select: { id: true, managerId: true } }),
      this.prisma.application.findMany({
        where: { id: { in: [...applicationIds] } },
        select: { id: true, ownerEmployeeId: true },
      }),
    ])

    return {
      userByEmployee: new Map(users.map((u) => [u.employeeId!, u.id])),
      employeeByUser: new Map(users.map((u) => [u.id, u.employeeId!])),
      managerOf: new Map(employees.map((e) => [e.id, e.managerId])),
      ownerOf: new Map(applications.map((a) => [a.id, a.ownerEmployeeId])),
    }
  }

  /**
   * Resolves every line. RA-03 produces TWO assignments per line -- the direct
   * manager at layer 1 and the application owner at layer 2 -- which is what
   * makes FR-B-015 rule 5's second-layer sign-off meaningful.
   */
  resolve(
    lines: readonly ResolvableLine[],
    rule: ReviewerRule,
    fallbackUserId: string,
    directory: Directory,
  ): ResolvedAssignment[] {
    const assignments: ResolvedAssignment[] = []

    for (const line of lines) {
      // FR-B-017 rule 3: a privileged entitlement is always two-layer, whatever
      // the campaign's rule says. The stricter treatment is a property of the
      // entitlement, not a setting somebody can forget to turn on.
      const twoLayer = rule.code === 'RA-03' || line.isPrivileged

      if (twoLayer) {
        assignments.push(this.assign(line, 1, this.managerUser(line, directory), fallbackUserId, directory))
        assignments.push(this.assign(line, 2, this.ownerUser(line, directory), fallbackUserId, directory))
        continue
      }

      assignments.push(
        this.assign(line, 1, this.byRule(line, rule, directory), fallbackUserId, directory),
      )
    }

    return assignments
  }

  private byRule(line: ResolvableLine, rule: ReviewerRule, dir: Directory): string | null {
    switch (rule.code) {
      case 'RA-01':
        return this.managerUser(line, dir)
      case 'RA-02':
        return this.ownerUser(line, dir)
      case 'RA-05':
        return rule.specificReviewerUserId ?? null
      case 'RA-04':
        // RA-04 routes to the entitlement's owner, but entitlement_catalog has
        // no owner column (TRD Sec 3.3). Rather than silently behave like RA-02
        // and let a campaign author believe they configured something they did
        // not, it resolves to nothing and every item lands on the fallback --
        // visibly, in the preview, where they can see it and choose again.
        return null
      case 'RA-03':
        return this.managerUser(line, dir)
      default:
        return null
    }
  }

  private managerUser(line: ResolvableLine, dir: Directory): string | null {
    if (!line.employeeId) return null
    const managerId = dir.managerOf.get(line.employeeId) ?? null
    return managerId ? (dir.userByEmployee.get(managerId) ?? null) : null
  }

  private ownerUser(line: ResolvableLine, dir: Directory): string | null {
    const ownerEmployeeId = dir.ownerOf.get(line.applicationId)
    return ownerEmployeeId ? (dir.userByEmployee.get(ownerEmployeeId) ?? null) : null
  }

  /** Applies rules 2, 3 and 1, in that order, to a candidate. */
  private assign(
    line: ResolvableLine,
    layerNo: number,
    candidate: string | null,
    fallbackUserId: string,
    dir: Directory,
  ): ResolvedAssignment {
    const base = { snapshotLineId: line.snapshotLineId, layerNo }

    if (!candidate) {
      return { ...base, reviewerUserId: fallbackUserId, via: 'FALLBACK_NO_REVIEWER' }
    }

    // FR-B-009 rule 2 -- nobody reviews their own access.
    const candidateEmployeeId = dir.employeeByUser.get(candidate)
    if (candidateEmployeeId && line.employeeId && candidateEmployeeId === line.employeeId) {
      const managerId = dir.managerOf.get(candidateEmployeeId) ?? null
      const managerUser = managerId ? dir.userByEmployee.get(managerId) : undefined
      if (managerUser && managerUser !== candidate) {
        return { ...base, reviewerUserId: managerUser, via: 'ESCALATED_SELF_REVIEW' }
      }
      return { ...base, reviewerUserId: fallbackUserId, via: 'FALLBACK_SELF_REVIEW' }
    }

    // Rule 3 is implicit here: loadDirectory only maps ACTIVE users, so an
    // inactive reviewer never becomes a candidate in the first place and the
    // line falls through to their manager or the fallback above.
    return { ...base, reviewerUserId: candidate, via: 'RULE' }
  }
}
