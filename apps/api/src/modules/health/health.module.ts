import { Module } from "@nestjs/common";
import { HealthController } from "./health.controller";

/**
 * Модуль проверки состояния приложения (§56 SPEC.md).
 *
 * Регистрирует `HealthController`; `PrismaService` доступен через глобальный
 * `PrismaModule`.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
