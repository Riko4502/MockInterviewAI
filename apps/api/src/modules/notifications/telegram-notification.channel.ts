import { Injectable, Logger } from "@nestjs/common";

import { buildDedupKey, type NotificationEvent } from "@packages/dto";

import { PrismaService } from "../../prisma/prisma.service";
import type {
  NotificationChannel,
  NotificationChannelDelivery,
} from "./notification-channel.interface";
import { RabbitMqPublisher } from "./rabbitmq-publisher.service";

/**
 * Канал доставки в Telegram (ADR-004:129).
 *
 * Канал не отправляет сообщение сам: он кладёт конверт в очередь, а
 * `apps/telegram-bot` — единственный консьюмер (ADR-004:109). Поэтому здесь
 * нет ни токена бота, ни ретраев, ни DLQ: всё это принадлежит потребителю.
 *
 * Решение о доставке принимает диспетчер, а не получатель: отсутствие
 * привязанного Telegram — это не ошибка доставки, и ронять из-за него строку
 * outbox нельзя (ADR-003:49).
 */
@Injectable()
export class TelegramNotificationChannel implements NotificationChannel {
  readonly name = "telegram";

  private readonly logger = new Logger(TelegramNotificationChannel.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: RabbitMqPublisher,
  ) {}

  async deliver(delivery: NotificationChannelDelivery): Promise<void> {
    const recipient = await this.prisma.user.findUnique({
      where: { id: delivery.recipientId },
      select: {
        telegramChatId: true,
        telegramLinkVerified: true,
        telegramLocale: true,
        locale: true,
        timezone: true,
      },
    });

    if (recipient === null) {
      this.logger.warn(
        `Recipient ${delivery.recipientId} not found; Telegram delivery skipped`,
      );
      return;
    }

    // Без подтверждённой привязки адресат не существует: `telegramChatId`
    // заполняется вместе с `telegramLinkVerified`, но проверяются оба, потому
    // что отвязка (ADR-005) обнуляет первый и обязана обнулить и второй.
    if (!recipient.telegramLinkVerified || !recipient.telegramChatId) {
      this.logger.debug(
        `Recipient ${delivery.recipientId} has no linked Telegram chat; delivery skipped`,
      );
      return;
    }

    await this.publisher.publish(
      {
        event: {
          type: delivery.event.type,
          payload: delivery.event.payload as Record<string, unknown>,
        },
        chatId: recipient.telegramChatId,
        // Явный выбор языка в боте (`telegramLocale`) приоритетнее языка
        // профиля: иначе `/lang` переставал бы влиять на push (ADR-005:117).
        locale: recipient.telegramLocale ?? recipient.locale,
        timeZone: recipient.timezone,
        ...(delivery.actionUrl ? { actionUrl: delivery.actionUrl } : {}),
      },
      // Тот же ключ идемпотентности, что и у in-app уведомления: повторная
      // доставка после таймаута публикации не создаст второго сообщения
      // (ADR-004:136).
      buildDedupKey(delivery.event as NotificationEvent, delivery.recipientId),
    );
  }
}
