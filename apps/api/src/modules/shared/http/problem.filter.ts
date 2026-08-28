import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Response } from 'express'
import type { SigapRequest } from './request.types.js'
import { MissingActorError, MissingAuditTrailError } from '../audit/audit.types.js'

const ERROR_BASE = 'https://sigap.internal.trimegah.com/errors'

/**
 * RFC 7807 responses (07-API-CONTRACT Sec 1.5).
 *
 * Unexpected errors return a generic message. Stack traces and driver errors go
 * to the log, never to the client: a database error text can disclose table
 * names, column names and constraint names, and this system's whole premise is
 * that unauthorised people should not learn what exists.
 */
@Catch()
export class ProblemFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const response = http.getResponse<Response>()
    const request = http.getRequest<SigapRequest>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let title = 'Kesalahan peladen'
    let detail = 'Terjadi kesalahan yang tidak terduga.'
    let code = 'INTERNAL_ERROR'
    let errors: unknown

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const body = exception.getResponse()
      title = exception.name
      if (typeof body === 'string') {
        detail = body
      } else if (body && typeof body === 'object') {
        const record = body as Record<string, unknown>
        detail = String(record.message ?? detail)
        if (Array.isArray(record.message)) {
          detail = `Terdapat ${record.message.length} bidang yang tidak memenuhi ketentuan.`
          errors = record.message
          code = 'VALIDATION_FAILED'
        }
      }
      if (code === 'INTERNAL_ERROR') code = httpCodeFor(status)
    } else if (exception instanceof MissingAuditTrailError || exception instanceof MissingActorError) {
      // Never a client mistake: it means a write path in this codebase failed to
      // record its audit entry, and the transaction was correctly rolled back.
      this.logger.error(exception.message)
      title = 'Kesalahan peladen'
      code = 'AUDIT_TRAIL_REQUIRED'
    } else {
      this.logger.error(exception instanceof Error ? exception.stack : String(exception))
    }

    response
      .status(status)
      .type('application/problem+json')
      .json({
        type: `${ERROR_BASE}/${code.toLowerCase().replace(/_/g, '-')}`,
        title,
        status,
        detail,
        instance: request.originalUrl,
        code,
        request_id: request.requestId ?? null,
        ...(errors ? { errors } : {}),
      })
  }
}

function httpCodeFor(status: number): string {
  switch (status) {
    case HttpStatus.UNAUTHORIZED:
      return 'UNAUTHENTICATED'
    case HttpStatus.FORBIDDEN:
      return 'FORBIDDEN'
    case HttpStatus.NOT_FOUND:
      return 'NOT_FOUND'
    case HttpStatus.CONFLICT:
      return 'CONFLICT'
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'VALIDATION_FAILED'
    case HttpStatus.LOCKED:
      return 'RESOURCE_LOCKED'
    default:
      return 'INTERNAL_ERROR'
  }
}
