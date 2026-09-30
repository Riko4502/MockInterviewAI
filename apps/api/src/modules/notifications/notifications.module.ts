import { Module } from "@nestjs/common";

import { InAppNotificationChannel } from "./in-app-notification.channel";
import { NOTIFICATION_CHANNELS } from "./notification-channel.interface";
import { NotificationDispatcher } from "./notification-dispatcher.service";
import { NotificationOutboxRelay } from "./notification-outbox-relay.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * Модуль уведомлений.
 *
 * Объединяет HTTP/SSE-контроллер, сервис доступа к данным уведомлений,
 * диспетчер с каналами доставки и релей outbox.
 *
 * Разделение соответствует ADR-003:33-34: `NotificationsService` отвечает за
 * данные, кэш и SSE-публикацию, а маршрутизация по каналам живёт в
 * диспетчере. Новый канал добавляется регистрацией адаптера в `channels`
 * ниже, без правок доменных сервисов.
 */
@Module({
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationDispatcher,
    NotificationOutboxRelay,
    InAppNotificationChannel,
    {
      provide: NOTIFICATION_CHANNELS,
      // ADR-004 добавит сюда telegram-адаптер; in-app присутствует всегда.
      useFactory: (inApp: InAppNotificationChannel) => [inApp],
      inject: [InAppNotificationChannel],
    },
  ],
  exports: [NotificationsService, NotificationDispatcher],
})
export class NotificationsModule {}
