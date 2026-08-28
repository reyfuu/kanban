import { randomUUID } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { PrismaService, type TransactionClient } from '../prisma/prisma.service.js'
import {
  sendsEmail,
  sendsInApp,
  specFor,
  type NotificationSpec,
} from './notification-matrix.js'

export interface NotifyInput {
  /** An NT code from FR-X-011. Unknown codes throw. */
  readonly code: string
  readonly recipientUserId: string
  readonly title: string
  readonly body?: string
  readonly objectType?: string
  readonly objectId?: string
  /**
   * FR-X-011 NT-20 · "Ya kecuali H-7". The exception belongs to the occasion,
   * not to the code, so the caller that knows it is the H-7 run says so here.
   * It can only make a notification MORE urgent, never less -- see `resolve`.
   */
  readonly forceImmediate?: boolean
}

/**
 * FR-X-010 · the notification engine.
 *
 * Two things here are load-bearing and are not obvious from the shape of the
 * code.
 *
 * FIRST: preferences are consulted only for codes the matrix marks summarizable.
 * FR-X-010 rule 2 forbids escalation and missed-deadline notifications from
 * being summarised or switched off, and the reason is worth stating plainly --
 * these messages exist precisely because someone has already stopped paying
 * attention. Letting that person mute them removes the control at the one
 * moment it is doing work. So the check is not "does the user allow this",
 * it is "is this the kind of thing a user is allowed to have an opinion about".
 *
 * SECOND: writes go through the caller's transaction. A notification is part of
 * the event that caused it; if a ticket creation rolls back, the "your ticket
 * was created" message must roll back with it. Accepting a `tx` rather than
 * opening its own connection is what makes that automatic instead of a rule
 * people have to remember.
 *
 * Email delivery itself is NOT implemented here and deliberately so: there is
 * no SMTP configuration in this deployment yet, and a fake sender that silently
 * discarded messages would be worse than an obvious gap -- the queue rows would
 * read as delivered. Rows are persisted with `emailStatus = 'ANTRE'` and a
 * real sender drains them later. `pendingEmails()` exists so that queue is
 * visible rather than theoretical.
 */
@Injectable()
export class NotificationService {
  private readonly log = new Logger(NotificationService.name)

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Queue one notification inside an existing transaction.
   *
   * Returns the row id, or null when the recipient's preferences legitimately
   * suppress it. Null is only ever possible for summarizable codes.
   */
  async notify(tx: TransactionClient, input: NotifyInput): Promise<string | null> {
    const spec = specFor(input.code)
    const decision = await this.resolve(spec, input)
    if (!decision.deliver) return null

    // An email-only code (NT-09, NT-27, NT-28) still gets a row. The row is the
    // durable record of what was sent and the queue the sender drains; skipping
    // it for email-only codes would leave those three with no trace at all
    // until an SMTP sender exists. `sendsInApp` decides visibility in the
    // notification centre, not whether the row is written.
    const showInCentre = sendsInApp(spec)

    const id = randomUUID()
    await tx.notification.create({
      data: {
        id,
        recipientUserId: input.recipientUserId,
        code: spec.code,
        title: input.title,
        body: input.body ?? null,
        objectType: input.objectType ?? null,
        objectId: input.objectId ?? null,
        // Stored per row rather than looked up at read time: a Compliance
        // Officer auditing why something was or was not summarised needs to see
        // what the rule was WHEN IT WAS SENT, not what the table says today.
        canBeSummarized: decision.canBeSummarized,
        emailStatus: sendsEmail(spec) ? 'ANTRE' : 'TIDAK_BERLAKU',
        // Email-only codes are marked read on creation so they never appear as
        // an unread item in a centre they were never meant to show in.
        isRead: !showInCentre,
      },
    })
    return id
  }

  /**
   * Queue for many recipients at once. Used by campaign launches, which notify
   * every reviewer, and where one row per recipient is the point -- a single
   * shared row could not carry per-person read state.
   */
  async notifyMany(
    tx: TransactionClient,
    recipientUserIds: readonly string[],
    input: Omit<NotifyInput, 'recipientUserId'>,
  ): Promise<number> {
    let sent = 0
    for (const recipientUserId of new Set(recipientUserIds)) {
      const id = await this.notify(tx, { ...input, recipientUserId })
      if (id) sent += 1
    }
    return sent
  }

  /**
   * Whether to deliver, and whether this row may ever be rolled into a digest.
   *
   * The asymmetry is intentional: `forceImmediate` can only upgrade urgency.
   * A caller cannot pass a flag that makes an escalation summarizable, because
   * the flag is never consulted in that direction.
   */
  private async resolve(
    spec: NotificationSpec,
    input: NotifyInput,
  ): Promise<{ deliver: boolean; canBeSummarized: boolean }> {
    // FR-X-010 rule 2 · not negotiable, so preferences are never loaded.
    if (!spec.canBeSummarized) return { deliver: true, canBeSummarized: false }
    if (input.forceImmediate) return { deliver: true, canBeSummarized: false }

    const pref = await this.prisma.notificationPreference.findUnique({
      where: { userId: input.recipientUserId },
      select: { defaultFrequency: true, categoryOverrides: true },
    })
    if (!pref) return { deliver: true, canBeSummarized: true }

    // A per-code override wins over the default, which is what makes "mute
    // everything except this one" expressible.
    const overrides = (pref.categoryOverrides ?? {}) as Record<string, unknown>
    const raw = overrides[spec.code]
    const frequency = typeof raw === 'string' ? raw : pref.defaultFrequency

    // Every frequency still delivers; frequency decides whether the row may be
    // batched into a digest, not whether the person is told at all. Dropping it
    // outright would lose the in-app record too, and the notification centre is
    // the durable copy.
    return { deliver: true, canBeSummarized: frequency !== 'SEKETIKA' }
  }

  /** FR-X-010 rule 4 · the email queue, visible to SYS_ADMIN. */
  async pendingEmails(limit = 100) {
    return this.prisma.notification.findMany({
      where: { emailStatus: 'ANTRE' },
      orderBy: { createdAt: 'asc' },
      take: limit,
      select: {
        id: true,
        code: true,
        recipientUserId: true,
        title: true,
        emailAttempts: true,
        createdAt: true,
      },
    })
  }

  /**
   * FR-X-010 rule 4 · record a delivery attempt.
   *
   * Three failures is the ceiling, after which the row is GAGAL and stays
   * visible rather than being retried forever or quietly dropped. A message
   * that can never be delivered is information a SYS_ADMIN needs, not noise to
   * be swept up.
   */
  async recordEmailAttempt(notificationId: string, ok: boolean): Promise<void> {
    const row = await this.prisma.notification.findUnique({
      where: { id: notificationId },
      select: { emailAttempts: true },
    })
    if (!row) return

    const attempts = row.emailAttempts + 1
    await this.prisma.notification.update({
      where: { id: notificationId },
      data: ok
        ? { emailStatus: 'TERKIRIM', emailAttempts: attempts }
        : {
            emailAttempts: attempts,
            ...(attempts >= 3
              ? { emailStatus: 'GAGAL', emailFailedAt: new Date() }
              : {}),
          },
    })
    if (!ok && attempts >= 3) {
      this.log.error(`Notifikasi ${notificationId} gagal dikirim setelah ${attempts} percobaan.`)
    }
  }

  /** The signed-in person's notification centre. */
  async inbox(userId: string, unreadOnly = false, limit = 50) {
    return this.prisma.notification.findMany({
      where: { recipientUserId: userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
  }

  async markRead(userId: string, notificationId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      // Scoped by recipient as well as id: without it, any authenticated user
      // could mark someone else's escalation as read.
      where: { id: notificationId, recipientUserId: userId },
      data: { isRead: true, readAt: new Date() },
    })
  }
}
