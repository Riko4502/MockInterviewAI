import { forwardRef, Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./services/auth-session.service";
import { TokenService } from "./services/token.service";

/**
 * Модуль аутентификации (§35 SPEC.md).
 *
 * Содержит `AuthController`, `AuthService`, `TokenService`, `AuthSessionService`.
 * Импортирует `UsersModule` для доступа к `UsersService` и `MailModule` для отправки писем.
 * `PrismaService` и `RedisService` доступны через глобальные модули.
 */
@Module({
  imports: [forwardRef(() => UsersModule), MailModule],
  controllers: [AuthController],
  providers: [AuthService, TokenService, AuthSessionService],
  exports: [AuthService, TokenService, AuthSessionService],
})
export class AuthModule {}
