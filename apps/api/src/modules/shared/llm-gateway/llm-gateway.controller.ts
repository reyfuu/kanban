import { Body, Controller, ForbiddenException, Get, Post, Req } from '@nestjs/common'
import { IsBoolean, IsString, MaxLength, MinLength } from 'class-validator'
import { LlmGatewayService } from './llm-gateway.service.js'
import type { SigapRequest } from '../http/request.types.js'
import { hasAnyRole } from '../authz/principal.js'
import { RequiresStepUp } from '../http/step-up.decorator.js'

export class SetGatewayEnabledDto {
  @IsBoolean()
  enabled!: boolean

  /**
   * Required in both directions. Switching the gateway ON is the more
   * consequential act -- it opens the only path by which internal data leaves
   * the company -- so it must be as attributable as switching it off.
   */
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason!: string
}

/**
 * FR-C-017 · the kill switch, and the gateway's own status.
 *
 * COMPLIANCE only, with step-up authentication (FR-X-003). The step-up is not
 * ceremony: this endpoint governs whether company data may leave the building,
 * and an unattended logged-in session should not be enough to open that path.
 */
@Controller('llm-gateway')
export class LlmGatewayController {
  constructor(private readonly gateway: LlmGatewayService) {}

  /**
   * Readable by any signed-in user, because the UI needs to know whether to
   * offer the answer feature at all (FR-C-017 rule 3 · tell the user it is
   * unavailable rather than letting the button fail).
   */
  @Get('status')
  async status() {
    const s = await this.gateway.currentSetting()
    return {
      data: {
        enabled: s?.enabled ?? false,
        // The reason is user-facing on purpose: "sedang tidak tersedia" with no
        // explanation invites people to keep retrying.
        reason: s?.disabledReason ?? null,
      },
    }
  }

  @Post('pemutus')
  @RequiresStepUp()
  async setEnabled(@Req() req: SigapRequest, @Body() dto: SetGatewayEnabledDto) {
    if (!hasAnyRole(req.principal!, 'COMPLIANCE')) {
      throw new ForbiddenException(
        'Hanya COMPLIANCE yang dapat mengubah pemutus layanan gerbang LLM.',
      )
    }
    await this.gateway.setEnabled(req.principal!.userId, dto.enabled, dto.reason)
    return { data: { enabled: dto.enabled } }
  }
}
