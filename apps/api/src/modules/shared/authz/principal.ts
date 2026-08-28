/**
 * The authenticated caller, resolved once per request.
 *
 * `roles` and `permissions` are the effective union across every currently
 * valid grant (FR-X-005 rule 1). `scopes` narrows what rows those permissions
 * reach (rule 2) and is applied in the repository layer -- never in a
 * controller, because a controller-level filter is skipped by every other call
 * path into the same repository.
 */
export interface Principal {
  readonly userId: string
  readonly externalId: string
  readonly employeeId: string | null
  readonly fullName: string
  /**
   * The person's job title, e.g. "IT Security Officer". Every user is also an
   * EMPLOYEE, so the role list alone is noisy for identifying who someone is;
   * the job title is what a person recognises. Null for a user with no employee
   * record (e.g. an external auditor account).
   */
  readonly jobTitle: string | null
  readonly roles: readonly string[]
  readonly permissions: readonly string[]
  /** Scope values keyed by dimension, e.g. `{ org_units: ['SKAI'] }`. */
  readonly scopes: Readonly<Record<string, readonly string[]>>
  readonly delegatedFrom: readonly { userId: string; fullName: string }[]
}

/** FR-X-005 rule 3 -- checked server-side on every request. Hiding a menu is not a control. */
export function hasPermission(principal: Principal, permission: string): boolean {
  return principal.permissions.includes(permission)
}

export function hasAnyRole(principal: Principal, ...roles: string[]): boolean {
  return roles.some((role) => principal.roles.includes(role))
}
