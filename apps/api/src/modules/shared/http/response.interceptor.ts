import { type CallHandler, type ExecutionContext, Injectable, type NestInterceptor } from '@nestjs/common'
import type { SigapRequest } from './request.types.js'
import { map, type Observable } from 'rxjs'

/**
 * Wraps handler results in the envelope from 07-API-CONTRACT Sec 1.4.
 *
 * Doing it centrally means no controller can forget, and the shape stays one
 * decision rather than one per endpoint. A handler that already returns
 * `{ data }` or `{ pagination }` is passed through untouched so paginated
 * collections can supply their own metadata.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<SigapRequest>()

    return next.handle().pipe(
      map((payload) => {
        const meta = {
          request_id: request.requestId ?? null,
          server_time: new Date().toISOString(),
        }

        if (payload && typeof payload === 'object' && 'data' in payload) {
          return { ...(payload as object), meta }
        }
        return { data: payload ?? null, meta }
      }),
    )
  }
}
