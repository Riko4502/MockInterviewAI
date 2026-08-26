import { forwardRef, Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { StorageModule } from "../storage/storage.module";
import { ProfileController } from "./profile.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

/**
 * Модуль управления пользователями и профилями.
 */
@Module({
  imports: [forwardRef(() => AuthModule), StorageModule],
  controllers: [ProfileController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
