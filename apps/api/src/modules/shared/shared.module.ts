import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service.js'
import { UnitOfWork } from './audit/unit-of-work.js'
import { AuditService } from './audit/audit.service.js'

/**
 * Cross-cutting foundation -- FR-X-001 s.d. FR-X-018.
 *
 * Global because every module writes, and every write goes through UnitOfWork.
 * Making each module import this explicitly would add ceremony without adding a
 * boundary: the ADR-01 boundary that matters is between feature modules, and it
 * is enforced by lint (see eslint.config.mjs).
 *
 * Built:
 *   audit/    FR-X-008, FR-X-009 · ADR-04 · kontrol kritis K-7
 *
 * Still to build, in the order the specification forces:
 *   identity/  FR-X-001..004 · ADR-06 -- LDAPS behind a neutral IdentityProvider
 *   authz/     FR-X-005..007 -- scope filtering in the repository layer, never
 *              in a controller: a controller-level filter is skipped by every
 *              other call path
 *   notification/ FR-X-010, FR-X-011 · antrean `notification`
 *   files/        FR-X-013, FR-X-014 · antrean `file-scan`
 */
@Global()
@Module({
  providers: [PrismaService, UnitOfWork, AuditService],
  exports: [PrismaService, UnitOfWork, AuditService],
})
export class SharedModule {}
