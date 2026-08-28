import { Controller, Get, Param, Post, Query, Req } from '@nestjs/common'
import { ForbiddenException } from '@nestjs/common'
import { NotificationService } from './notification.service.js'
import type { SigapRequest } from '../http/request.types.js'
import { hasAnyRole } from '../authz/principal.js'

/**
 * FR-X-010 · the in-app notification centre.
 *
 * Every route here is scoped to the signed-in person by construction, not by a
 * permission check: there is no notion of "read someone else's notifications",
 * so the recipient id is taken from the session and never from the request.
 * A `?user_id=` parameter would be a way to read another person's escalations,
 * and the safest version of that parameter is the one that does not exist.
 */
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async inbox(@Req() req: SigapRequest, @Query('unread') unread?: string) {
    const data = await this.notifications.inbox(req.principal!.userId, unread === 'true')
    return { data }
  }

  @Post(':id/baca')
  async markRead(@Req() req: SigapRequest, @Param('id') id: string) {
    await this.notifications.markRead(req.principal!.userId, id)
    return { data: { id, read: true } }
  }

  /**
   * FR-X-010 rule 4 · the failed/pending email queue.
   *
   * SYS_ADMIN only, because this is the one route that shows notifications
   * addressed to other people. It deliberately returns titles and recipients
   * but no body: an operator needs to know THAT delivery is stuck, not to read
   * the contents of everyone's messages.
   */
  @Get('antrean-surel')
  async pending(@Req() req: SigapRequest) {
    if (!hasAnyRole(req.principal!, 'SYS_ADMIN')) {
      throw new ForbiddenException('Hanya SYS_ADMIN yang dapat melihat antrean surel.')
    }
    return { data: await this.notifications.pendingEmails() }
  }
}
