import { Controller, ForbiddenException, Get, Post, Query, Req } from '@nestjs/common'
import type { SigapRequest } from '../http/request.types.js'
import { PrismaService } from '../prisma/prisma.service.js'
import { AuditService } from './audit.service.js'

/**
 * FR-X-008 rule 5 and FR-X-009.
 *
 * Permission is checked here because there is no repository-level scope to
 * apply: the audit trail is deliberately not scoped by org unit -- an audit
 * trail that only shows you your own actions cannot be used to check anyone.
 * Access is all-or-nothing and limited to COMPLIANCE and AUDIT_LEAD, which is
 * exactly what FR-X-008 rule 5 says.
 */
@Controller('audit-logs')
export class AuditController {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  async list(@Req() req: SigapRequest, @Query('limit') limit?: string) {
    this.requireVerifier(req)

    const take = Math.min(Math.max(Number(limit) || 50, 1), 200)
    const rows = await this.prisma.auditLog.findMany({
      orderBy: { id: 'desc' },
      take,
      include: { actor: { include: { employee: true } } },
    })

    return {
      data: rows.map((row) => ({
        id: row.id.toString(),
        occurred_at: row.occurredAt.toISOString(),
        actor: {
          id: row.actorId,
          full_name: row.actor.employee?.fullName ?? row.actor.externalId,
        },
        actor_role_at_action: row.actorRoleAtAction,
        action: row.action,
        object_type: row.objectType,
        object_id: row.objectId,
        before_value: row.beforeValue,
        after_value: row.afterValue,
        ip_address: row.ipAddress,
        request_id: row.requestId,
        prev_hash: row.prevHash,
        hash: row.hash,
      })),
    }
  }

  @Post('verify-chain')
  async verify(@Req() req: SigapRequest) {
    this.requireVerifier(req)

    const result = await this.audit.verifyChain()
    return {
      data: {
        is_valid: result.isValid,
        broken_at: result.brokenAt?.toString() ?? null,
        rows_checked: result.rowsChecked.toString(),
        verified_at: new Date().toISOString(),
      },
    }
  }

  private requireVerifier(req: SigapRequest): void {
    if (!req.principal?.permissions.includes('audit-log:verify')) {
      // 403, not 404: the existence of an audit trail is not a secret -- the
      // whole point is that everyone knows their actions are recorded. The
      // 404-instead-of-403 convention (07-API-CONTRACT Sec 1.6) applies to
      // objects whose existence leaks something, which this is the opposite of.
      throw new ForbiddenException('Hanya COMPLIANCE dan AUDIT_LEAD yang dapat membuka jejak audit.')
    }
  }
}
