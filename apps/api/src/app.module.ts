import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { configuration } from "./config/configuration";
import { validate } from "./config/env.validation";
import { HealthModule } from "./modules/health/health.module";
import { PrismaModule } from "./prisma/prisma.module";

/**
 * Корневой модуль приложения (bootstrap).
 *
 * Регистрирует глобальный `ConfigModule` (валидация окружения, §49 SPEC.md),
 * глобальный `PrismaModule` и `HealthModule`.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [configuration],
    }),
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
