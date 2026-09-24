import { forwardRef, Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { StorageModule } from "../storage/storage.module";
import { UsersModule } from "../users/users.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthSessionService } from "./services/auth-session.service";
import { GithubOAuthService } from "./services/github-oauth.service";
import { SessionRevocationCron } from "./services/session-revocation.cron";
import { TelegramOAuthService } from "./services/telegram-oauth.service";
import { TokenService } from "./services/token.service";

/**
 * Модуль аутентификации (§35 SPEC.md).
 *
 * Содержит `AuthController`, `AuthService`, `TokenService`, `AuthSessionService`, `SessionRevocationCron`.
 * Импортирует `UsersModule` для доступа к `UsersService` и `MailModule` для отправки писем.
 * `PrismaService` и `RedisService` доступны через глобальные модули.
 */
@Module({
  imports: [forwardRef(() => UsersModule), MailModule, StorageModule],
  controllers: [AuthController],
  providers: [
    GithubOAuthService,
    AuthService,
    TokenService,
    AuthSessionService,
    SessionRevocationCron,
    TelegramOAuthService,
  ],
  exports: [
    AuthService,
    TokenService,
    AuthSessionService,
    SessionRevocationCron,
    TelegramOAuthService,
  ],
})
export class AuthModule {}
