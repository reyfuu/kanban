import 'reflect-metadata'
import { loadWorkspaceEnv } from './load-env.js'

// Before any import that reads process.env at module scope.
loadWorkspaceEnv()
import { NestFactory, Reflector } from '@nestjs/core'
import { Logger, ValidationPipe } from '@nestjs/common'
import helmet from 'helmet'
import { AppModule } from './app.module.js'
import {
  AuthGuard,
  ProblemFilter,
  ResponseInterceptor,
  StepUpGuard,
} from './modules/shared/index.js'
import { StepUpService } from './modules/shared/identity/step-up.service.js'

/**
 * API process entrypoint (ADR-08).
 *
 * Serves user requests only. Long-running work -- connector syncs, document
 * indexing, embedding, report generation -- belongs to the worker process so
 * that indexing a thousand documents never slows a user's search.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  app.use(helmet())

  // `trust proxy` so req.ip is the caller, not the reverse proxy. The audit
  // trail records the source IP (FR-X-008 rule 1), and an audit trail that
  // records the load balancer for every action records nothing useful.
  app.getHttpAdapter().getInstance().set('trust proxy', true)

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  )
  // Order matters: AuthGuard establishes that there IS a principal, StepUpGuard
  // then asks whether that principal re-authenticated recently enough
  // (FR-X-003). Both are global so protection is the default state.
  app.useGlobalGuards(
    new AuthGuard(app.get(Reflector)),
    new StepUpGuard(app.get(Reflector), app.get(StepUpService)),
  )
  app.useGlobalInterceptors(new ResponseInterceptor())
  app.useGlobalFilters(new ProblemFilter())

  app.setGlobalPrefix('api/v1')
  app.enableCors({ origin: process.env.WEB_ORIGIN ?? 'http://localhost:3000', credentials: true })
  app.enableShutdownHooks()
  app.flushLogs()

  const port = Number(process.env.API_PORT ?? 3001)
  await app.listen(port)

  Logger.log(`SIGAP API siap pada porta ${port}`, 'Bootstrap')
}

void bootstrap()
