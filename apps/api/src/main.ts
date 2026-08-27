import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { Logger, ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module.js'

/**
 * API process entrypoint (ADR-08).
 *
 * This process serves user requests only. Long-running work — connector syncs,
 * document indexing, embedding, report generation — belongs to the worker
 * process so that indexing a thousand documents never slows a user's search.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.use(helmet())
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
  app.setGlobalPrefix('api/v1')
  app.enableShutdownHooks()

  const port = Number(process.env.API_PORT ?? 3001)
  await app.listen(port)

  Logger.log(`SIGAP API siap pada porta ${port}`, 'Bootstrap')
}

void bootstrap()
