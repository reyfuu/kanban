import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { StepUpService } from '../identity/step-up.service.js'
import type { SigapRequest } from './request.types.js'
import { REQUIRES_STEP_UP } from './step-up.decorator.js'

/**
 * Enforces FR-X-003 on routes marked with @RequiresStepUp().
 *
 * Registered globally, so the check runs on the route regardless of which
 * controller or service path reached it. Putting the check inside a service
 * method instead would leave it correct only for as long as nobody adds a
 * second caller.
 *
 * Runs after AuthGuard, so a principal and a session are already present; a
 * request that got here without them is a wiring mistake, and it is refused
 * rather than waved through.
 */
@Injectable()
export class StepUpGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly stepUp: StepUpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRES_STEP_UP, [
      context.getHandler(),
      context.getClass(),
    ])
    if (!required) return true

    const request = context.switchToHttp().getRequest<SigapRequest>()
    const token = request.header('X-Step-Up-Token')

    if (!token || !request.principal || !request.sessionId) throw stepUpRequired()

    const ok = await this.stepUp.verify({
      token,
      userId: request.principal.userId,
      sessionId: request.sessionId,
    })
    if (!ok) throw stepUpRequired()

    return true
  }
}

/**
 * One message for absent, expired, unknown and wrong-session tokens. The client
 * needs to do the same thing in every case -- ask for the password again -- and
 * distinguishing them tells a token holder which part they got wrong.
 */
function stepUpRequired(): UnauthorizedException {
  return new UnauthorizedException(
    'Aksi ini memerlukan autentikasi ulang. Masukkan kata sandi Anda kembali.',
  )
}
