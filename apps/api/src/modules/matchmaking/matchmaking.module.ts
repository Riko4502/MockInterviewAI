import { Module } from "@nestjs/common";
import { ShowcaseModule } from "../showcase/showcase.module";
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
 */
@Module({
  imports: [ShowcaseModule],
  controllers: [MatchmakingController],
  providers: [MatchmakingService, MatchmakingCronService],
  exports: [MatchmakingService],
})
export class MatchmakingModule {}
