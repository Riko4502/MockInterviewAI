import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { RealtimeController } from "./realtime.controller";

/**
 * Модуль выдачи WS-тикетов (`/api/v1/realtime`).
 *
 * Использует `TokenService` из `AuthModule` для подписи одноразовых тикетов.
 * Глобальный `AccessTokenGuard` применяется автоматически (маршрут не `@Public`).
 */
@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
})
export class RealtimeModule {}
