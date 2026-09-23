import {
  type MiddlewareConsumer,
  Module,
  type NestModule,
} from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AccessTokenGuard } from "./common/guards/access-token.guard";
import { OriginCheckGuard } from "./common/guards/origin-check.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { MetricsMiddleware } from "./common/metrics/metrics.middleware";
import { MetricsModule } from "./common/metrics/metrics.module";
import { configuration } from "./config/configuration";
import { validate } from "./config/env.validation";
import { AdminModule } from "./modules/admin/admin.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { MailModule } from "./modules/mail/mail.module";
import { MatchmakingModule } from "./modules/matchmaking/matchmaking.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { RealtimeModule } from "./modules/realtime/realtime.module";
import { SessionsModule } from "./modules/sessions/sessions.module";
import { ShowcaseModule } from "./modules/showcase/showcase.module";
import { StorageModule } from "./modules/storage/storage.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { UsersModule } from "./modules/users/users.module";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./redis/redis.module";

/**
 * Корневой модуль приложения (bootstrap).
 *
 * Регистрирует глобальный `ConfigModule` (валидация окружения, §49 SPEC.md),
 * глобальный `PrismaModule`, глобальный `RedisModule`, `ThrottlerModule`
 * (rate limiting, §41 SPEC.md), `HealthModule`, `UsersModule`, `AuthModule`
 * и глобальные guard'ы в строгом порядке:
 * 1. `AccessTokenGuard` (JWT и live-проверка в Redis, §64 SPEC.md)
 * 2. `RolesGuard` (RBAC / PBAC авторизация, @Roles, @RequirePermissions)
 * 3. `OriginCheckGuard` (CSRF, §29 SPEC.md)
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
    MetricsModule,
    ScheduleModule.forRoot(),
    HealthModule,
    UsersModule,
    AuthModule,
    AdminModule,
    MailModule,
    StorageModule,
    SessionsModule,
    RealtimeModule,
    NotificationsModule,
    TelegramModule,
    ShowcaseModule,
    MatchmakingModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: OriginCheckGuard,
    },
    MetricsMiddleware,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(MetricsMiddleware).forRoutes("*");
  }
}
