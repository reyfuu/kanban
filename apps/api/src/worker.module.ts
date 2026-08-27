import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { SharedModule } from './modules/shared/index.js'

/**
 * Background worker (ADR-08).
 *
 * Queue names, priorities, and retry policy are specified in 04-TRD §2 ADR-08.
 * They are declared here as BullMQ registrations when the first consumer is
 * built — not copied into a constant beforehand, which would only create a
 * second version of the table to drift from the first.
 */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true, envFilePath: ['.env'] }), SharedModule],
})
export class WorkerModule {}
