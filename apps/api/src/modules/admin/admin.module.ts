import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AdminUsersController } from "./controllers/admin-users.controller";
import { AdminUsersService } from "./services/admin-users.service";

/**
 * Административный модуль управления платформой.
 *
 * Содержит эндпоинты управления пользователями, ролями, сессиями и настройками.
 */
@Module({
  imports: [AuthModule],
  controllers: [AdminUsersController],
  providers: [AdminUsersService],
  exports: [AdminUsersService],
})
export class AdminModule {}
