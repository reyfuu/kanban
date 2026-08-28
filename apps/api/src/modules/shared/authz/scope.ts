import type { Principal } from './principal.js'

/**
 * Scope dimensions (FR-X-005 rule 2).
 *
 * A closed set rather than free strings, because a typo in a dimension name
 * silently produces "no scope on this dimension" -- which the filters below
 * read as unrestricted. A misspelled scope must not widen access.
 */
export const SCOPE_ORG_UNITS = 'org_units'
export const SCOPE_APPLICATIONS = 'applications'

/**
 * Row-level scope, resolved from a principal, applied in the repository layer.
 *
 * CLAUDE.md rule 1 puts this in repositories rather than controllers, and the
 * reason is not tidiness: a controller-level filter is correct only for the
 * call paths that go through that controller. Add a background job, a report
 * exporter, or a second endpoint over the same repository and the filter is
 * simply absent, with nothing to notice it.
 *
 * `isUnrestricted` is a real and intended state, not a hole. COMPLIANCE and
 * AUDIT_LEAD hold firm-wide authority by design (FRD Sec 1.4) -- an auditor who
 * can only see their own division cannot audit the firm. The distinction that
 * matters is that being unrestricted is the result of resolving a grant with no
 * scope, never the result of a lookup that found nothing.
 */
export class ScopeFilter {
  private constructor(
    readonly dimension: string,
    /** null means no restriction on this dimension. */
    readonly values: readonly string[] | null,
  ) {}

  static from(principal: Principal, dimension: string): ScopeFilter {
    const values = principal.scopes[dimension]
    // An absent dimension means the principal's grants carry no restriction on
    // it. An EMPTY array is different: it is a scope that was set and narrowed
    // to nothing, and it must match nothing rather than everything.
    if (values === undefined) return new ScopeFilter(dimension, null)
    return new ScopeFilter(dimension, [...values])
  }

  get isUnrestricted(): boolean {
    return this.values === null
  }

  /** True when the principal's scope on this dimension admits `value`. */
  admits(value: string | null | undefined): boolean {
    if (this.values === null) return true
    if (value == null) return false
    return this.values.includes(value)
  }

  /**
   * A Prisma `where` fragment for a column carrying this dimension's value.
   *
   * Returns `{}` when unrestricted, so it can be spread into a where clause
   * unconditionally. Returning `undefined` and making every call site decide
   * whether to include it is how a filter goes missing at one of them.
   */
  whereOn(column: string): Record<string, unknown> {
    if (this.values === null) return {}
    return { [column]: { in: this.values } }
  }
}

/**
 * Scope narrowed to the applications a principal may see.
 *
 * Kept separate from the generic helper because Modul B asks the question
 * often and the dimension name should be written down once.
 */
export function applicationScope(principal: Principal): ScopeFilter {
  return ScopeFilter.from(principal, SCOPE_APPLICATIONS)
}

export function orgUnitScope(principal: Principal): ScopeFilter {
  return ScopeFilter.from(principal, SCOPE_ORG_UNITS)
}
