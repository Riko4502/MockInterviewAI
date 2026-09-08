import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { LivekitService } from "./livekit.service";
import { RealtimeController } from "./realtime.controller";

/**
 * Модуль выдачи WS-тикетов и LiveKit media-токенов (`/api/v1/realtime`).
 *
 * Использует `TokenService` из `AuthModule` для подписи одноразовых тикетов
 * и `LivekitService` для генерации LiveKit access tokens.
 * Глобальный `AccessTokenGuard` применяется автоматически (маршрут не `@Public`).
 */
@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
  providers: [LivekitService],
  exports: [LivekitService],
})
export class RealtimeModule {}
