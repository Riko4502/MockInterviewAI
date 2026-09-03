import { Module } from "@nestjs/common";
import { SessionsController } from "./sessions.controller";
import { SessionsService } from "./sessions.service";

/**
 * Модуль интервью-сессий.
 *
 * Содержит `SessionsService` (источник правды о членстве в Postgres +
 * Redis-зеркало) и `SessionsController`. `PrismaService`/`RedisService`
 * доступны через глобальные модули.
 */
@Module({
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
