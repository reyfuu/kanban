import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'

/**
 * The application's PrismaClient.
 *
 * Connects as the runtime role (DATABASE_URL), which holds INSERT and SELECT on
 * audit_log and nothing else. Migrations use a different role entirely --
 * see directUrl in schema.prisma and Sec 2b of the foundation migration.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit(): Promise<void> {
    await this.$connect()
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}

/**
 * A Prisma client bound to an open transaction.
 *
 * Repositories accept this rather than the root client so that a caller cannot
 * accidentally run a write outside the unit of work that carries its audit
 * entry (FR-X-008 Validasi).
 */
export type TransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>
