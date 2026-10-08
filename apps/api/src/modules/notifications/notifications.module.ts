import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { InAppNotificationChannel } from "./in-app-notification.channel";
import { NOTIFICATION_CHANNELS } from "./notification-channel.interface";
import { NotificationDispatcher } from "./notification-dispatcher.service";
import { NotificationOutboxMonitor } from "./notification-outbox-monitor.service";
import { NotificationOutboxRelay } from "./notification-outbox-relay.service";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import {
  AMQP_CONNECTION_FACTORY,
  amqpConnectionFactory,
  RabbitMqPublisher,
} from "./rabbitmq-publisher.service";
import { TelegramNotificationChannel } from "./telegram-notification.channel";

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
    NotificationOutboxMonitor,
    InAppNotificationChannel,
    TelegramNotificationChannel,
    RabbitMqPublisher,
    {
      provide: AMQP_CONNECTION_FACTORY,
      useValue: amqpConnectionFactory,
    },
    {
      provide: NOTIFICATION_CHANNELS,
      // in-app идёт первым и присутствует всегда: диспетчер прерывает обход
      // на первом упавшем канале, поэтому отказ push-канала не должен лишать
      // получателя уведомления в приложении (ADR-003:49).
      useFactory: (
        config: ConfigService,
        inApp: InAppNotificationChannel,
        telegram: TelegramNotificationChannel,
      ) => {
        const url = config.get<string>("rabbitmq.url") ?? "";
        return url === "" ? [inApp] : [inApp, telegram];
      },
      inject: [
        ConfigService,
        InAppNotificationChannel,
        TelegramNotificationChannel,
      ],
    },
  ],
  exports: [NotificationsService, NotificationDispatcher],
})
export class NotificationsModule {}
