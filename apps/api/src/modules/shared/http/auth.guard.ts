import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import type { SigapRequest } from './request.types.js'
import { IS_PUBLIC } from './public.decorator.js'

/**
 * Denies every route that is not explicitly public (FR-X-005 rule 3).
 *
 * Registered globally, so protection is the default state and exposure is the
 * thing you have to write down.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ])
    if (isPublic) return true

    const request = context.switchToHttp().getRequest<SigapRequest>()
    if (!request.principal) throw new UnauthorizedException('Sesi tidak sah atau telah berakhir.')

    return true
  }
}
