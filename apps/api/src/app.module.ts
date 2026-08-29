import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ThrottlerModule } from "@nestjs/throttler";
import { AccessTokenGuard } from "./common/guards/access-token.guard";
import { OriginCheckGuard } from "./common/guards/origin-check.guard";
import { configuration } from "./config/configuration";
import { validate } from "./config/env.validation";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";

/**
 * Корневой модуль приложения (bootstrap).
 *
 * Регистрирует глобальный `ConfigModule` (валидация окружения, §49 SPEC.md),
 * глобальный `PrismaModule`, глобальный `RedisModule`, `ThrottlerModule`
 * (rate limiting, §41 SPEC.md), `HealthModule`, `UsersModule`, `AuthModule`
 * и глобальные guard'ы: `AccessTokenGuard` (§64 SPEC.md) и
 * `OriginCheckGuard` (CSRF, §29 SPEC.md).
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
      load: [configuration],
      envFilePath: ["../../.env", ".env"],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>("throttle.ttl") ?? 60_000,
          limit: config.get<number>("throttle.limit") ?? 100,
        },
      ],
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    UsersModule,
    AuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OriginCheckGuard,
    },
  ],
})
export class AppModule {}
