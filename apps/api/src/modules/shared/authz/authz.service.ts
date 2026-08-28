import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'
import type { Principal } from './principal.js'

/**
 * Resolves effective authority for a user at a point in time.
 *
 * Every grant carries validFrom and an optional validUntil (FR-X-005 rule 4),
 * so authority is a function of the clock, not a stored flag. Resolving it per
 * request rather than caching it on login is what makes FR-X-002 rule 3 work --
 * a role revoked now stops applying now, including to sessions already open.
 */
@Injectable()
export class AuthzService {
  constructor(private readonly prisma: PrismaService) {}

  /** Login resolves by directory identifier; everything after that uses the internal id. */
  async resolveByExternalId(externalId: string, at: Date = new Date()) {
    const user = await this.prisma.appUser.findUnique({ where: { externalId }, select: { id: true } })
    return user ? this.resolve(user.id, at) : null
  }

  async resolve(userId: string, at: Date = new Date()): Promise<Principal | null> {
    const user = await this.prisma.appUser.findUnique({
      where: { id: userId },
      include: { employee: { include: { orgUnit: true } } },
    })
    if (!user || !user.isActive) return null

    // FR-X-004 rule 4: an external account lapses on its expiry date with no
    // intervention, so expiry is enforced on read rather than by a nightly job
    // that might not have run.
    if (user.expiresAt && user.expiresAt <= at) return null

    const grants = await this.prisma.userRole.findMany({
      where: {
        userId,
        validFrom: { lte: at },
        OR: [{ validUntil: null }, { validUntil: { gte: at } }],
      },
      include: { role: { include: { rolePermissions: { include: { permission: true } } } } },
    })

    const roles = new Set<string>()
    const permissions = new Set<string>()
    const scopes: Record<string, Set<string>> = {}

    for (const grant of grants) {
      roles.add(grant.role.code)
      for (const rp of grant.role.rolePermissions) permissions.add(rp.permission.code)

      // Scope is stored as { dimension: [values] }. Absent scope means the role
      // is unscoped -- which is a real and intended state for e.g. COMPLIANCE.
      if (grant.scope && typeof grant.scope === 'object' && !Array.isArray(grant.scope)) {
        for (const [dimension, values] of Object.entries(grant.scope as Record<string, unknown>)) {
          if (!Array.isArray(values)) continue
          scopes[dimension] ??= new Set()
          for (const value of values) scopes[dimension]!.add(String(value))
        }
      }
    }

    // FR-X-007 rule 3: a decision made under delegation is recorded as "on
    // behalf of". The delegation is surfaced here so the UI and the audit entry
    // can say whose authority was used, rather than silently merging it.
    const delegations = await this.prisma.delegation.findMany({
      where: {
        toUserId: userId,
        isActive: true,
        validFrom: { lte: at },
        validUntil: { gte: at },
      },
      include: { fromUser: { include: { employee: true } } },
    })

    return {
      userId: user.id,
      externalId: user.externalId,
      employeeId: user.employeeId,
      fullName: user.employee?.fullName ?? user.externalId,
      roles: [...roles],
      permissions: [...permissions],
      scopes: Object.fromEntries(Object.entries(scopes).map(([k, v]) => [k, [...v]])),
      delegatedFrom: delegations.map((d) => ({
        userId: d.fromUserId,
        fullName: d.fromUser.employee?.fullName ?? d.fromUser.externalId,
      })),
    }
  }
}
