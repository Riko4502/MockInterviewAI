import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { SecurityEventsModule } from "../security-events/security-events.module";
import { TelegramController } from "./telegram.controller";
import { TelegramService } from "./telegram.service";

/**
 * Модуль интеграции с Telegram-ботом (§7 docs/TELEGRAM_BOT_ARCHITECTURE.md).
 *
 * `PrismaModule` и `RedisModule` зарегистрированы глобально — DI доступен
 * без импорта. Контроллер скрыт из публичной OpenAPI
 * (`@ApiExcludeController`), все вызовы бота аутентифицируются
 * `InternalServiceKeyGuard` (`X-Internal-Service-Key`).
 *
 * `AuthModule` нужен ради `AuthSessionService`, `SecurityEventsModule` — ради
 * аудита привязки `TG_LINKED` (D3).
 */
@Module({
  imports: [AuthModule, SecurityEventsModule],
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
