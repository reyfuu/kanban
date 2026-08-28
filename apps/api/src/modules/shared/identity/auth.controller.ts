import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common'
import { IsNotEmpty, IsString, MaxLength } from 'class-validator'
import type { SigapRequest } from '../http/request.types.js'
import { Public } from '../http/public.decorator.js'
import { AuthService } from './auth.service.js'
import { SessionService } from './session.service.js'

class LoginDto {
  @IsString()
  @IsNotEmpty({ message: 'Nama pengguna wajib diisi.' })
  @MaxLength(100)
  username!: string

  @IsString()
  @IsNotEmpty({ message: 'Kata sandi wajib diisi.' })
  @MaxLength(200)
  password!: string
}

/** 07-API-CONTRACT Sec 2. */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto, @Req() req: SigapRequest) {
    const result = await this.auth.login({
      username: dto.username,
      password: dto.password,
      ipAddress: req.ip ?? 'unknown',
      userAgent: req.header('User-Agent') ?? null,
      requestId: req.requestId ?? 'unknown',
    })

    return {
      data: {
        access_token: result.accessToken,
        token_type: 'Bearer',
        expires_in: result.expiresIn,
        user: {
          id: result.principal.userId,
          external_id: result.principal.externalId,
          full_name: result.principal.fullName,
          roles: result.principal.roles,
        },
      },
    }
  }

  /** 07-API-CONTRACT Sec 2.4. */
  @Get('me')
  me(@Req() req: SigapRequest) {
    const p = req.principal!
    return {
      data: {
        id: p.userId,
        external_id: p.externalId,
        full_name: p.fullName,
        roles: p.roles,
        permissions: p.permissions,
        scopes: p.scopes,
        delegations_received: p.delegatedFrom.map((d) => ({
          from_user: { id: d.userId, full_name: d.fullName },
        })),
      },
    }
  }

  /** FR-X-002 rule 2 -- a user can see and end their own sessions elsewhere. */
  @Get('sessions')
  async listSessions(@Req() req: SigapRequest) {
    const rows = await this.sessions.listActive(req.principal!.userId)
    return {
      data: rows.map((s) => ({
        id: s.id,
        issued_at: s.issuedAt.toISOString(),
        last_active_at: s.lastActiveAt.toISOString(),
        absolute_expires_at: s.absoluteExpiresAt.toISOString(),
        ip_address: s.ipAddress,
        user_agent: s.userAgent,
        is_current: s.id === req.sessionId,
      })),
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: SigapRequest): Promise<void> {
    await this.auth.logout({
      sessionId: req.sessionId!,
      principal: req.principal!,
      requestId: req.requestId ?? 'unknown',
      ipAddress: req.ip ?? 'unknown',
    })
  }
}
