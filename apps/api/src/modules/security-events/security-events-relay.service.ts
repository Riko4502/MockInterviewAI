import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import type { SecurityNotificationEventType } from "@packages/dto";
import { SecurityEventType } from "../../generated/prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RabbitMqPublisher } from "../notifications/rabbitmq-publisher.service";
import {
  SECURITY_RELAY_BASE_BACKOFF_MS,
  SECURITY_RELAY_BATCH_SIZE,
  SECURITY_RELAY_INTERVAL_CRON,
  SECURITY_RELAY_MAX_ATTEMPTS,
} from "./security-events.constants";

/** Событие, которое умеет уходить в Telegram push, и его шаблон рендера. */
const PUSHABLE_EVENTS: Partial<
  Record<SecurityEventType, SecurityNotificationEventType>
> = {
  [SecurityEventType.TG_UNLINKED]: "security.telegram_unlinked",
  [SecurityEventType.GITHUB_UNLINKED]: "security.github_unlinked",
};

/**
 * Доставка security-событий (plan D7).
 *
 * `SecurityEvent` играет роль outbox-таблицы: relay забирает строки без
 * `notifiedAt`, отправляет их в Telegram через `RabbitMqPublisher` и повторяет
 * с backoff. Отдельная `NotificationOutbox` не используется намеренно —
 * ADR-005:74 запрещает смешивать security-события с уведомлениями.
 *
 * Событие, для которого канала нет (`TG_UNLINKED` не имеет `telegramChatId`
 * после отвязки), не теряется: оно помечается `deliverySkippedAt` и остаётся
 * в выборке непросмотренных для in-app-показа при следующем входе (D8).
 */
@Injectable()
export class SecurityEventsRelay {
  private readonly logger = new Logger(SecurityEventsRelay.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMqPublisher,
  ) {}

  @Cron(SECURITY_RELAY_INTERVAL_CRON)
  async relay(): Promise<void> {
    // Тесты делят одну БД: фоновый проход конкурировал бы за строки с другими
    // Nest-инстансами. Проверяется сам `relay()` вызовом напрямую.
    if (process.env.NODE_ENV === "test") {
      return;
    }

    const due = await this.prisma.securityEvent.findMany({
      where: {
        notifiedAt: null,
        deliverySkippedAt: null,
        attempts: { lt: SECURITY_RELAY_MAX_ATTEMPTS },
        nextAttemptAt: { lte: new Date() },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: SECURITY_RELAY_BATCH_SIZE,
      select: { id: true, attempts: true },
    });

    for (const row of due) {
      await this.process(row.id, row.attempts);
    }
  }

  /**
   * Забирает строку себе сравнением `attempts` (compare-and-swap в одном
   * UPDATE) и выполняет одну попытку доставки.
   */
  private async process(id: string, expectedAttempts: number): Promise<void> {
    const claimed = await this.prisma.securityEvent.updateMany({
      where: {
        id,
        notifiedAt: null,
        deliverySkippedAt: null,
        attempts: expectedAttempts,
      },
      data: { attempts: { increment: 1 } },
    });

    if (claimed.count === 0) {
      return;
    }

    const row = await this.prisma.securityEvent.findUniqueOrThrow({
      where: { id },
      include: {
        user: {
          select: {
            telegramChatId: true,
            telegramLinkVerified: true,
            telegramLocale: true,
            locale: true,
            timezone: true,
          },
        },
      },
    });

    const template = PUSHABLE_EVENTS[row.type];

    // Нечего отправлять: либо у события нет push-шаблона, либо у получателя
    // нет подтверждённой привязки Telegram. В обоих случаях доставка не
    // выполняется, и событие обязано остаться для in-app (D7, D8).
    if (
      template === undefined ||
      !row.user.telegramLinkVerified ||
      !row.user.telegramChatId
    ) {
      await this.markSkipped(row.id);
      return;
    }

    try {
      await this.publisher.publish(
        {
          event: {
            type: template,
            payload: { occurredAt: row.createdAt.toISOString() },
          },
          chatId: row.user.telegramChatId,
          locale: row.user.telegramLocale ?? row.user.locale,
          timeZone: row.user.timezone,
        },
        // Идемпотентность: одна строка события — одно сообщение, даже если
        // публикация повторилась после таймаута (ADR-004:136).
        `security:${row.id}`,
      );

      await this.prisma.securityEvent.update({
        where: { id: row.id },
        data: { notifiedAt: new Date(), lastError: null },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `Security event ${row.id} delivery attempt ${row.attempts + 1} failed: ${message}`,
      );

      await this.prisma.securityEvent.update({
        where: { id: row.id },
        data: {
          nextAttemptAt: new Date(Date.now() + this.backoffMs(row.attempts)),
          lastError: message.slice(0, 1000),
        },
      });
    }
  }

  /**
   * Фиксирует, что push-доставка не выполнялась и не будет повторяться.
   * `notifiedAt` остаётся `null` — именно по нему in-app выбирает события.
   */
  private async markSkipped(id: string): Promise<void> {
    await this.prisma.securityEvent.update({
      where: { id },
      data: { deliverySkippedAt: new Date() },
    });
  }

  private backoffMs(attempts: number): number {
    return SECURITY_RELAY_BASE_BACKOFF_MS * 2 ** attempts;
  }
}
