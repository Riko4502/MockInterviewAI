import { forwardRef, Module } from "@nestjs/common";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./services/auth-session.service";
import { TokenService } from "./services/token.service";

/**
 * Модуль аутентификации (§35 SPEC.md).
 *
 * Содержит `AuthController`, `AuthService`, `TokenService`, `AuthSessionService`.
 * Импортирует `UsersModule` для доступа к `UsersService`.
 * `PrismaService` и `RedisService` доступны через глобальные модули.
 */
@Module({
  imports: [forwardRef(() => UsersModule)],
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthSessionService],
  exports: [AuthService, TokenService, AuthSessionService],
})
export class AuthModule {}
