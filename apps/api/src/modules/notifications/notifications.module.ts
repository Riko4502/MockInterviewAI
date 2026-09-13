import { Module } from "@nestjs/common";

import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";

/**
 * Модуль уведомлений.
 *
 * Объединяет HTTP/SSE-контроллер уведомлений и сервис,
 * отвечающий за работу с уведомлениями и их realtime-доставку.
 *
 * NotificationsService экспортируется, чтобы другие модули приложения
 * могли создавать уведомления при возникновении бизнес-событий.
 */
@Module({
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
