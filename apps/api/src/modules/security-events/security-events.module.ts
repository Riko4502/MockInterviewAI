import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SecurityEventsController } from "./security-events.controller";
import { SecurityEventsService } from "./security-events.service";
import { SecurityEventsRelay } from "./security-events-relay.service";
import { SecurityEventsRetentionCron } from "./security-events-retention.cron";

/**
 * Аудит security-событий и их доставка (ADR-005).
 *
 * `NotificationsModule` нужен только ради `RabbitMqPublisher`: relay
 * публикует security-уведомления в ту же очередь бота, но не пишет в
 * `notifications`/`notification_outbox` (ADR-005:74). `SecurityEventsService`
 * экспортируется, чтобы доменные сервисы (`UsersService`, `TelegramService`)
 * могли записать событие в своей транзакции.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [SecurityEventsController],
  providers: [
    SecurityEventsService,
    SecurityEventsRelay,
    SecurityEventsRetentionCron,
  ],
  exports: [SecurityEventsService],
})
export class SecurityEventsModule {}
