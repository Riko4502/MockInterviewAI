import { Global, Module } from "@nestjs/common";
import { RedisService } from "./redis.service";

/**
 * Глобальный модуль Redis.
 *
 * Экспортирует `RedisService` для всех модулей приложения без повторного
 * импорта `RedisModule`.
 */
@Global()
@Module({
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
