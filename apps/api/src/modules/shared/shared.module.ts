import { Global, type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common'
import { PrismaService } from './prisma/prisma.service.js'
import { UnitOfWork } from './audit/unit-of-work.js'
import { AuditService } from './audit/audit.service.js'
import { AuditController } from './audit/audit.controller.js'
import { AuthzService } from './authz/authz.service.js'
import { IdentityProvider, assertProviderAllowed } from './identity/identity-provider.js'
import { SeedIdentityProvider } from './identity/seed-identity.provider.js'
import { SessionService } from './identity/session.service.js'
import { StepUpService } from './identity/step-up.service.js'
import { AuthService } from './identity/auth.service.js'
import { AuthController } from './identity/auth.controller.js'
import { ContextMiddleware } from './http/context.middleware.js'

/**
 * Cross-cutting foundation -- FR-X-001 s.d. FR-X-018.
 *
 * Global because every module writes, and every write goes through UnitOfWork.
 * The ADR-01 boundary that matters is between feature modules, and lint
 * enforces that one.
 *
 * Built: audit/ (FR-X-008, ADR-04, K-7) · identity/ (FR-X-001..004, ADR-06) ·
 * authz/ (FR-X-005..007) · http/ (07-API-CONTRACT Sec 1)
 *
 * Still to build: notification/ (FR-X-010, FR-X-011) · files/ (FR-X-013)
 */
@Global()
@Module({
  controllers: [AuthController, AuditController],
  providers: [
    PrismaService,
    UnitOfWork,
    AuditService,
    AuthzService,
    SessionService,
    StepUpService,
    AuthService,
    {
      // ADR-06: which implementation is a configuration choice, and the rest of
      // the system never learns which one it got.
      provide: IdentityProvider,
      useFactory: (prisma: PrismaService): IdentityProvider => {
        const provider = new SeedIdentityProvider(prisma)
        assertProviderAllowed(provider, process.env.NODE_ENV)
        return provider
      },
      inject: [PrismaService],
    },
  ],
  exports: [
    PrismaService,
    UnitOfWork,
    AuditService,
    AuthzService,
    SessionService,
    StepUpService,
    AuthService,
  ],
})
export class SharedModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(ContextMiddleware).forRoutes('*splat')
  }
}
