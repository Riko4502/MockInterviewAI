import { Injectable } from "@nestjs/common";

import {
  type NotificationChannel,
  type NotificationChannelDelivery,
} from "./notification-channel.interface";
import { NotificationsService } from "./notifications.service";

/**
 * In-app канал: запись в `Notification` и SSE-событие (ADR-003:50).
 *
 * Существующий `NotificationsService` остаётся сервисом доступа к данным, кэша
 * и SSE-публикации, а маршрутизация живёт в диспетчере: дописывать каналы в
 * него означало бы превратить его в god-service (ADR-003:33).
 */
@Injectable()
export class InAppNotificationChannel implements NotificationChannel {
  readonly name = "in-app";

  constructor(private readonly notifications: NotificationsService) {}

  async deliver(delivery: NotificationChannelDelivery): Promise<void> {
    await this.notifications.createNotification({
      userId: delivery.recipientId,
      type: delivery.event.type,
      payload: delivery.event.payload,
      ...(delivery.actionUrl ? { actionUrl: delivery.actionUrl } : {}),
    });
  }
}
