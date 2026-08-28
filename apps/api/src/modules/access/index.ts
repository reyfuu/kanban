/**
 * Public interface of the `access` module (ADR-01).
 *
 * Other modules may import from this file and nothing else inside `access/`.
 *
 * RevocationService is exported because FR-B-020 verification is triggered by
 * snapshot ingestion, which will live in the worker process. Nothing else is
 * exported: the decision path (K-2, K-3, K-4) and the sign-off path (K-9) are
 * reachable only through this module's own controllers, so there is no second
 * way in that could skip their checks.
 */
export { AccessModule } from './access.module.js'
export { RevocationService, type VerificationOutcome } from './revocation.service.js'
