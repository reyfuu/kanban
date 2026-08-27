/**
 * Public interface of the `shared` module (ADR-01).
 *
 * Everything other modules are allowed to touch is re-exported here. Anything
 * not exported from this file is private to the module, and the lint rule
 * enforces that — not convention, not review discipline.
 *
 * Adding an export here is an architectural decision: it widens the surface
 * three other modules can depend on. Prefer keeping it narrow.
 */
export { SharedModule } from './shared.module.js'
