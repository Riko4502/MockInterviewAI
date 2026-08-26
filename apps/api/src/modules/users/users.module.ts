import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ProfileController } from "./profile.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * Модуль управления пользователями и профилями.
 */
@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [ProfileController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
