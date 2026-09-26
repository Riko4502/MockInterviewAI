import { Module } from "@nestjs/common";
import { TelegramController } from "./telegram.controller";
import { TelegramService } from "./telegram.service";

/**
 * Модуль интеграции с Telegram-ботом (§7 docs/TELEGRAM_BOT_ARCHITECTURE.md).
 *
 * `PrismaModule` и `RedisModule` зарегистрированы глобально — DI доступен
 * без импорта. Контроллер скрыт из публичной OpenAPI
 * (`@ApiExcludeController`), все вызовы бота аутентифицируются
 * `InternalServiceKeyGuard` (`X-Internal-Service-Key`).
 */
@Module({
  controllers: [TelegramController],
  providers: [TelegramService],
})
export class TelegramModule {}
