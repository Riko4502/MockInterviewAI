import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  type NotificationEvent,
  notificationEventCategory,
  parseNotificationEvent,
} from "@packages/dto";
import { MetricsService } from "../../common/metrics/metrics.service";
import { type NotificationOutbox, Prisma } from "../../generated/prisma/client";
import {
  NOTIFICATION_CHANNELS,
  type NotificationChannel,
} from "./notification-channel.interface";

/**
 * Точка входа для доменного кода (ADR-003:48-49).
 *
 * Доменный сервис знает, ЧТО произошло, и не знает, есть ли у получателя
 * Telegram, включены ли пуши и есть ли подключён SSE. Куда доставить решает
 * диспетчер, и только когда релей разберёт строку outbox.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    private readonly metrics: MetricsService,
    @Inject(NOTIFICATION_CHANNELS)
    private readonly channels: NotificationChannel[],
  ) {}

  /**
   * Кладёт событие в outbox.
   *
   * `tx` обязателен для вызова из доменной транзакции: строка пишется рядом с
   * изменением бизнес-данных, поэтому откат транзакции уносит и событие
   * (ADR-003:65-66). Публикация после commit потеряла бы событие при падении
   * процесса в промежутке между ними.
   */
  async dispatch(
    event: NotificationEvent,
    recipientId: string,
    tx: Prisma.TransactionClient,
    actionUrl?: string,
  ): Promise<NotificationOutbox> {
    const parsed = parseNotificationEvent(event);

    // Ключ идемпотентности живёт на Notification, а не здесь: повторная
    // доставка возможна (at-least-once), и уникальный индекс на Notification
    // превращает её в upsert без дубля в колокольчике.
    return tx.notificationOutbox.create({
      data: {
        type: parsed.type,
        payload: parsed.payload,
        recipientId,
        category: notificationEventCategory[parsed.type],
        ...(actionUrl ? { actionUrl } : {}),
      },
    });
  }

  /**
   * Доставляет одну строку outbox по всем каналам (ADR-003:49).
   *
   * Обход прерывается на первом упавшем канале: строка возвращается в `PENDING`
   * и будет доставлена целиком позже, когда канал оживёт. Поэтому порядок
   * каналов значим — дешёвый и всегда доступный in-app должен идти первым,
   * иначе отказ push-канала оставил бы получателя без уведомления в
   * приложении. Частичная доставка не считается успехом: получателю лучше
   * получить всё с задержкой, чем часть сразу.
   */
  async deliver(row: NotificationOutbox): Promise<void> {
    const event = parseNotificationEvent({
      type: row.type,
      payload: row.payload as NotificationEvent["payload"],
    });

    for (const channel of this.channels) {
      try {
        await channel.deliver({
          event,
          recipientId: row.recipientId,
          ...(row.actionUrl ? { actionUrl: row.actionUrl } : {}),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        this.metrics.incOutboxPublishFailure(channel.name);
        this.logger.error(
          `Channel ${channel.name} failed for outbox ${row.id}: ${message}`,
        );
        throw error;
      }
    }
  }

  get channelNames(): string[] {
    return this.channels.map((channel) => channel.name);
  }
}
