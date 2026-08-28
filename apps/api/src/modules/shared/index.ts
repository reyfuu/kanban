/**
 * Public interface of the `shared` module (ADR-01).
 *
 * Anything not exported here is private to the module, and lint enforces that
 * rather than convention or review discipline. Adding an export widens the
 * surface three other modules depend on -- keep it narrow.
 */
export { SharedModule } from './shared.module.js'
export { PrismaService, type TransactionClient } from './prisma/prisma.service.js'
export { ensureRedisReady } from './redis/redis.connect.js'
export { UnitOfWork } from './audit/unit-of-work.js'
export { AuditService, type ChainVerification } from './audit/audit.service.js'
export type { AuditRecorder } from './audit/audit.recorder.js'
export { type AuditEntry, MissingAuditTrailError, MissingActorError } from './audit/audit.types.js'
export {
  type RequestContext,
  runWithRequestContext,
  getRequestContext,
} from './request-context/request-context.js'
export { type Principal, hasPermission, hasAnyRole } from './authz/principal.js'
export { AuthzService } from './authz/authz.service.js'
export {
  ScopeFilter,
  applicationScope,
  orgUnitScope,
  SCOPE_APPLICATIONS,
  SCOPE_ORG_UNITS,
} from './authz/scope.js'
export { NotificationService, type NotifyInput } from './notification/notification.service.js'
export {
  NOTIFICATION_MATRIX,
  specFor,
  sendsEmail,
  sendsInApp,
  type NotificationSpec,
} from './notification/notification-matrix.js'
export { Public } from './http/public.decorator.js'
export { AuthGuard } from './http/auth.guard.js'
export { StepUpGuard } from './http/step-up.guard.js'
export { RequiresStepUp } from './http/step-up.decorator.js'
export type { SigapRequest } from './http/request.types.js'
export { ResponseInterceptor } from './http/response.interceptor.js'
export { ProblemFilter } from './http/problem.filter.js'
