import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminUsersService } from "./services/admin-users.service";

/**
 * Административный модуль управления платформой.
 *
 * Содержит эндпоинты управления пользователями, ролями, сессиями и настройками.
 */
@Module({
  imports: [AuthModule, StorageModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminModule {}
