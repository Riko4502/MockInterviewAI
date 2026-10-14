import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SessionReminderService } from "./session-reminder.service";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";

/**
 * Модуль интервью-сессий.
 *
 * Содержит `SessionsService` (источник правды о членстве в Postgres +
 * Redis-зеркало), `SessionReminderService` и `SessionsController`.
 */
@Module({
  imports: [NotificationsModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionReminderService],
  exports: [SessionsService, SessionReminderService],
})
export class SessionsModule {}
