/**
 * Public interface of the `shared` module (ADR-01).
 *
 * Anything not exported here is private to the module, and lint enforces that
 * rather than convention or review discipline. Adding an export widens the
 * surface three other modules depend on -- keep it narrow.
 */
export { SharedModule } from './shared.module.js'
export { PrismaService, type TransactionClient } from './prisma/prisma.service.js'
export { UnitOfWork } from './audit/unit-of-work.js'
export { AuditService, type ChainVerification } from './audit/audit.service.js'
export type { AuditRecorder } from './audit/audit.recorder.js'
export { type AuditEntry, MissingAuditTrailError, MissingActorError } from './audit/audit.types.js'
export {
  type RequestContext,
  runWithRequestContext,
  getRequestContext,
} from './request-context/request-context.js'
