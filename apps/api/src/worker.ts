import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { WorkerModule } from './worker.module.js'

/**
 * Background worker entrypoint (ADR-08).
 *
 * Same codebase as the API, separate process. Queue names are fixed by
 * 04-TRD §2 ADR-08 — see QUEUES in worker.module.ts. Do not invent new queue
 * names; the retry and priority policy is specified per queue.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true })
  app.enableShutdownHooks()

  Logger.log('SIGAP worker siap', 'Bootstrap')
}

void bootstrap()
