import { Module } from "@nestjs/common";
import { NotificationsModule } from "../notifications/notifications.module";
import { SessionsModule } from "../sessions/sessions.module";
import { MatchmakingController } from "./matchmaking.controller";
import { MatchmakingService } from "./matchmaking.service";
import { MatchmakingCronService } from "./matchmaking-cron.service";

/**
 * Модуль матчмейкинга (системы взаимных откликов на мок-интервью).
 *
 * Инкапсулирует:
 * - Бизнес-правила отправки откликов (лимиты 10 входящих / 5 исходящих, 24ч кулдаун, авто-матч);
 * - REST API эндпоинты управления заявками (принятие, отклонение, отмена, просмотр);
 * - Фоновый воркер авто-экспирации просроченных заявок (каждый час).
 *
 * `NotificationsModule` подключён ради `NotificationDispatcher`: предложение
 * слота и подтверждение брони — доменные события, и они должны попадать в
 * outbox в той же транзакции, что и сама заявка (ADR-003:65-66).
 *
 * `SessionsModule` (ветка dev) предоставляет управление сессиями интервью,
 * на которые ведут принятые заявки.
 */
@Module({
  imports: [NotificationsModule, SessionsModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingCronService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
