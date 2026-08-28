import 'reflect-metadata'
import { loadWorkspaceEnv } from './load-env.js'

// Before any import that reads process.env at module scope.
loadWorkspaceEnv()
import { NestFactory } from '@nestjs/core'
import { Logger } from '@nestjs/common'
import { WorkerModule } from './worker.module.js'

/**
 * Background worker entrypoint (ADR-08).
 *
 * Same codebase as the API, separate process. Queue names, priorities and retry
 * policy are specified in 04-TRD Sec 2 ADR-08 and are registered here as BullMQ
 * consumers when the first job type is built.
 *
 * Two things below look like boilerplate and are not:
 *
 * `flushLogs()` -- NestFactory buffers log output until told otherwise. Without
 * the flush, the startup line is written into the buffer and then discarded on
 * exit, so the process looks silent even when it started correctly.
 *
 * The signal promise -- an application context holds nothing open by itself, so
 * Node's event loop empties and the process exits the moment bootstrap returns.
 * Once BullMQ consumers exist they will hold it open on their own, but until
 * then `pnpm dev:worker` would start and die instantly, which reads as a broken
 * command rather than as an idle worker.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(WorkerModule, { bufferLogs: true })
  app.enableShutdownHooks()
  app.flushLogs()

  Logger.log('SIGAP worker siap — belum ada antrean yang dikonsumsi', 'Bootstrap')

  await new Promise<void>((resolve) => {
    for (const signal of ['SIGINT', 'SIGTERM'] as const) {
      process.once(signal, () => {
        Logger.log(`Menerima ${signal}, menghentikan worker`, 'Bootstrap')
        resolve()
      })
    }
  })

  await app.close()
}

void bootstrap()
