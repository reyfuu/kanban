import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service.js'
import {
  type AuthenticatedPrincipal,
  type Credentials,
  IdentityProvider,
  type UserAttributes,
} from './identity-provider.js'

/**
 * Directory-free identity provider for local development and client demos.
 *
 * There is no Active Directory on a laptop, and FR-X-001 Jalur pengecualian
 * already anticipates the directory being unreachable. This satisfies ADR-06 by
 * being a second implementation of the same interface rather than a bypass
 * around it: nothing downstream can tell which provider it is talking to, so
 * nothing downstream grows a demo-only code path.
 *
 * It verifies that the account exists and is active in SIGAP, then checks a
 * single shared password. It does NOT verify identity -- any user who knows the
 * demo password can sign in as anybody. `isTrustworthy` is false for exactly
 * that reason, and assertProviderAllowed refuses to boot with it outside
 * development.
 */
@Injectable()
export class SeedIdentityProvider extends IdentityProvider {
  readonly name = 'seed'
  readonly isTrustworthy = false

  private readonly logger = new Logger(SeedIdentityProvider.name)
  private readonly password: string

  constructor(private readonly prisma: PrismaService) {
    super()
    this.password = process.env.SEED_IDENTITY_PASSWORD ?? 'demo'
    this.logger.warn(
      'Penyedia identitas SEED aktif — identitas TIDAK diverifikasi ke direktori. ' +
        'Hanya untuk pengembangan dan demo.',
    )
  }

  async authenticate(credentials: Credentials): Promise<AuthenticatedPrincipal | null> {
    // Password first, and always compared, so a wrong username and a wrong
    // password take the same path. FR-X-001 requires the two to be
    // indistinguishable from outside.
    const passwordOk = credentials.password === this.password

    const user = await this.prisma.appUser.findUnique({
      where: { externalId: credentials.username },
      include: { employee: true },
    })

    if (!passwordOk || !user || !user.isActive) return null

    return {
      externalId: user.externalId,
      displayName: user.employee?.fullName ?? user.externalId,
      email: user.employee?.email ?? null,
    }
  }

  async getUserAttributes(externalId: string): Promise<UserAttributes | null> {
    const user = await this.prisma.appUser.findUnique({
      where: { externalId },
      include: { employee: { include: { orgUnit: true } } },
    })
    if (!user) return null

    return {
      externalId: user.externalId,
      displayName: user.employee?.fullName ?? user.externalId,
      email: user.employee?.email ?? null,
      jobTitle: user.employee?.jobTitle ?? null,
      department: user.employee?.orgUnit?.name ?? null,
    }
  }

  async isActive(externalId: string): Promise<boolean> {
    const user = await this.prisma.appUser.findUnique({ where: { externalId } })
    return user?.isActive ?? false
  }
}
