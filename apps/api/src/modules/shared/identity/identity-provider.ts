/**
 * ADR-06 -- authentication goes through LDAPS to Active Directory, but no
 * application code talks to LDAP. Everything goes through this interface, so
 * moving to Keycloak or Entra ID later is a new implementation rather than a
 * rewrite.
 */
export interface Credentials {
  readonly username: string
  readonly password: string
}

export interface AuthenticatedPrincipal {
  /** `sAMAccountName` in AD terms; maps to app_user.external_id (FR-X-001). */
  readonly externalId: string
  readonly displayName: string
  readonly email: string | null
}

export interface UserAttributes {
  readonly externalId: string
  readonly displayName: string
  readonly email: string | null
  readonly jobTitle: string | null
  readonly department: string | null
}

export abstract class IdentityProvider {
  /** Human-readable name; appears in startup logs and in the audit trail. */
  abstract readonly name: string

  /**
   * True when this provider does not actually verify identity against a
   * corporate directory. Checked at boot -- see assertProviderAllowed.
   */
  abstract readonly isTrustworthy: boolean

  /**
   * FR-X-001 Validasi: a failure to reach the directory must never grant
   * access. Implementations return null or throw; neither may mean "allow".
   */
  abstract authenticate(credentials: Credentials): Promise<AuthenticatedPrincipal | null>

  abstract getUserAttributes(externalId: string): Promise<UserAttributes | null>

  /**
   * FR-X-001 rule 3: an account disabled in the directory is refused entry even
   * when its SIGAP account is still active.
   */
  abstract isActive(externalId: string): Promise<boolean>
}

/**
 * Refuses to boot with a non-directory provider outside development.
 *
 * The demo provider accepts a shared password. That is entirely reasonable for
 * a laptop and a client walkthrough, and catastrophic anywhere real -- and the
 * way it gets somewhere real is never a decision, it is an env var that was
 * already set when someone promoted the config.
 *
 * So the check is here, at startup, where it stops the process rather than
 * producing a system that authenticates everyone.
 */
export function assertProviderAllowed(provider: IdentityProvider, nodeEnv: string | undefined): void {
  if (provider.isTrustworthy) return
  if (nodeEnv === 'development' || nodeEnv === 'test') return

  throw new Error(
    `Penyedia identitas "${provider.name}" tidak memverifikasi identitas ke direktori korporat ` +
      `dan tidak boleh berjalan dengan NODE_ENV=${nodeEnv}. ` +
      `Setel IDENTITY_PROVIDER=ldap (ADR-06, FR-X-001).`,
  )
}
