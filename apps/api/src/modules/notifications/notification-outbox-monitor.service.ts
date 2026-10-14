import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import * as Sentry from "@sentry/nestjs";

import { MetricsService } from "../../common/metrics/metrics.service";
import { NotificationOutboxStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

/** Порог алерта: возраст самой старой неотправленной строки (ADR-004:142). */
export const OUTBOX_MAX_OLDEST_AGE_SECONDS = 5 * 60;

/** Порог алерта: число неотправленных строк (ADR-004:142). */
export const OUTBOX_MAX_PENDING_ROWS = 1000;

/**
 * Наблюдаемость буфера outbox (ADR-004:140, :142).
 *
 * Релей буферизует события, пока брокер недоступен, и без наблюдаемости этот
 * буфер растёт молча. Пороги взяты из ADR: возраст самой старой неотправленной
 * строки и их количество. `FAILED` считаются неотправленными тоже: релей
 * помечает их после исчерпания попыток, и без вмешательства человека они
 * больше не будут доставлены.
 */
@Injectable()
export class NotificationOutboxMonitor {
  private readonly logger = new Logger(NotificationOutboxMonitor.name);

  private lastAlertAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  @Cron("* * * * * *")
  async check(): Promise<void> {
    // Как и релей: в тестах фоновая задача молчит, иначе сьюты делят одну БД
    // и наблюдение конкурировало бы за строки с другими Nest-инстансами.
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const [pending, failed, oldest] = await Promise.all([
      this.prisma.notificationOutbox.count({
        where: { status: NotificationOutboxStatus.PENDING },
      }),
      this.prisma.notificationOutbox.count({
        where: { status: NotificationOutboxStatus.FAILED },
      }),
      this.prisma.notificationOutbox.findFirst({
        where: { status: NotificationOutboxStatus.PENDING },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
    ]);

    const oldestAgeSeconds =
      oldest === null
        ? 0
        : Math.round((Date.now() - oldest.createdAt.getTime()) / 1000);

    this.metrics.setOutboxBacklog({
      pending,
      failed,
      oldestAgeSeconds,
    });

    this.alertIfExceeded(pending, failed, oldestAgeSeconds);
  }

  private alertIfExceeded(
    pending: number,
    failed: number,
    oldestAgeSeconds: number,
  ): void {
    const exceededAge = oldestAgeSeconds > OUTBOX_MAX_OLDEST_AGE_SECONDS;
    const exceededCount = pending > OUTBOX_MAX_PENDING_ROWS;

    if (!exceededAge && !exceededCount) {
      return;
    }

    const message =
      `Notification outbox is not draining: pending=${pending}, failed=${failed}, ` +
      `oldest=${oldestAgeSeconds}s (limits: ${OUTBOX_MAX_PENDING_ROWS} rows / ` +
      `${OUTBOX_MAX_OLDEST_AGE_SECONDS}s). Telegram push delivery is delayed or stopped.`;

    // Порог срабатывает каждую минуту, а буфер может держаться часами: без
    // паузы один инцидент превращается в сотни алертов.
    if (Date.now() - this.lastAlertAt < OUTBOX_MAX_OLDEST_AGE_SECONDS * 1000) {
      return;
    }
    this.lastAlertAt = Date.now();

    this.logger.error(message);
    Sentry.captureMessage(message, "error");
  }
}
