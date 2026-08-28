import { Injectable, Logger } from '@nestjs/common'
import {
  NotificationService,
  PrismaService,
  UnitOfWork,
} from '../shared/index.js'
import { ESCALATION_LADDER, isCritical, stageFor, type EscalationStage } from './escalation-rules.js'

/**
 * FR-A-008 · chase overdue evidence requests automatically.
 *
 * Meant to be run once a day by the worker (ADR-08). It is written as one
 * method taking `today` rather than reading the clock internally, because that
 * is the difference between a schedule that can be tested and one that can only
 * be observed in production a day at a time.
 *
 * Only requests that are actually outstanding are chased. A request already
 * fulfilled or closed is not late no matter what its due date says, and
 * escalating one to a PIC's manager would be both wrong and, from the PIC's
 * point of view, unanswerable.
 */
@Injectable()
export class EscalationService {
  private readonly log = new Logger(EscalationService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly uow: UnitOfWork,
    private readonly notifications: NotificationService,
  ) {}

  /**
   * Run one day's reminders. Returns a per-stage count so an operator can see
   * that it did something, and so a run that silently matched nothing is
   * distinguishable from a run that did not happen.
   */
  async runDailyChase(today: Date = new Date()): Promise<{ stage: string; sent: number }[]> {
    const outstanding = await this.prisma.requestItem.findMany({
      where: {
        // The states where someone still owes evidence. DRAF has not been
        // issued to anyone yet; SELESAI and TIDAK_BERLAKU are closed and are
        // not late whatever their due date says. DALAM_PENELAAHAN is excluded
        // deliberately -- the PIC has delivered and the ball is with the
        // auditor, so chasing the PIC would be blaming them for a queue they
        // do not control.
        status: { in: ['TERBIT', 'DISERAHKAN', 'INFO_TAMBAHAN'] },
      },
      select: {
        id: true,
        description: true,
        dueDate: true,
        engagementId: true,
        picEmployee: {
          select: {
            id: true,
            managerId: true,
            appUser: { select: { id: true } },
          },
        },
        engagement: { select: { leadAuditorId: true, code: true } },
      },
    })

    const results = new Map<string, number>(ESCALATION_LADDER.map((s) => [s.label, 0]))

    for (const item of outstanding) {
      const stage = stageFor(item.dueDate, today)
      if (!stage) continue

      const recipients = await this.recipientsFor(stage, item)
      if (recipients.length === 0) {
        // Worth logging rather than passing over: a request whose PIC has no
        // application account can never be chased, and that is a data problem
        // someone has to fix, not a quiet no-op.
        this.log.warn(
          `Permintaan ${item.id} melewati tahap "${stage.label}" tanpa penerima yang dapat dihubungi.`,
        )
        continue
      }

      await this.uow.write(async (tx, audit) => {
        const sent = await this.notifications.notifyMany(tx, recipients, {
          code: stage.notificationCode,
          title: this.titleFor(stage, item.engagement.code),
          body: item.description,
          objectType: 'REQUEST_ITEM',
          objectId: item.id,
        })

        // The escalation itself is auditable. FR-A-008 is a control, and a
        // control that leaves no record cannot be shown to have operated --
        // which is the exact question an auditor asks about it.
        await audit.record({
          action: 'ESKALASI_PERMINTAAN_BUKTI',
          objectType: 'REQUEST_ITEM',
          objectId: item.id,
          after: {
            stage: stage.label,
            notification_code: stage.notificationCode,
            recipients: recipients.length,
            critical: isCritical(item.dueDate, today),
          },
        })

        results.set(stage.label, (results.get(stage.label) ?? 0) + sent)
      })
    }

    return [...results].map(([stage, sent]) => ({ stage, sent }))
  }

  /**
   * FR-A-008 · who hears about this stage.
   *
   * Each rung ADDS an audience rather than replacing one. The PIC stays on
   * every message about their own item, including the one that goes to their
   * manager, because being escalated about without being told is how people
   * find out from their manager rather than from the system.
   */
  private async recipientsFor(
    stage: EscalationStage,
    item: {
      picEmployee: { id: string; managerId: string | null; appUser: { id: string } | null }
      engagement: { leadAuditorId: string }
    },
  ): Promise<string[]> {
    const out: string[] = []

    const pic = item.picEmployee.appUser?.id
    if (pic) out.push(pic)

    if (stage.audience !== 'PIC' && item.picEmployee.managerId) {
      const manager = await this.prisma.appUser.findFirst({
        where: { employeeId: item.picEmployee.managerId },
        select: { id: true },
      })
      if (manager) out.push(manager.id)
    }

    if (stage.audience === 'PIC_ATASAN_DAN_KETUA_TIM' || stage.audience === 'KRITIS') {
      out.push(item.engagement.leadAuditorId)
    }

    return out
  }

  /**
   * FR-A-008 · requests that reached the critical rung.
   *
   * Computed from the due date rather than stored as a flag, so it cannot go
   * stale: a flag would need clearing when a request is finally fulfilled, and
   * the day someone forgets is the day the executive dashboard starts lying.
   */
  async criticalItems(today: Date = new Date()) {
    const rows = await this.prisma.requestItem.findMany({
      where: { status: { in: ['TERBIT', 'DISERAHKAN', 'INFO_TAMBAHAN'] } },
      select: {
        id: true,
        description: true,
        dueDate: true,
        engagement: { select: { code: true, title: true } },
        picEmployee: { select: { fullName: true } },
      },
      orderBy: { dueDate: 'asc' },
    })
    return rows.filter((r) => isCritical(r.dueDate, today))
  }

  private titleFor(stage: EscalationStage, engagementCode: string): string {
    return stage.offsetDays < 0
      ? `Pengingat: permintaan bukti ${engagementCode} jatuh tempo ${Math.abs(stage.offsetDays)} hari lagi`
      : `Permintaan bukti ${engagementCode} melewati tenggat (${stage.label})`
  }
}
