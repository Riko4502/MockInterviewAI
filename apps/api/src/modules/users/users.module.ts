import { Module } from "@nestjs/common";
import { UsersService } from "./users.service";

/**
 * Модуль управления пользователями (§9, §10 SPEC.md).
 *
 * Экспортирует `UsersService` для использования другими модулями
 * (например, `AuthModule`). `PrismaService` доступен через глобальный
 * `PrismaModule`.
 */
@Module({
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
