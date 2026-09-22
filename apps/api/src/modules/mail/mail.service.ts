import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

/**
 * Сервис отправки почтовых сообщений.
 *
 * На текущем этапе (отсутствие внешнего SMTP-сервера) работает в mock-режиме:
 * логирует детали отправки писем со ссылками и токенами.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Отправляет (логирует) письмо для сброса пароля.
   *
   * @param email - Адрес получателя.
   * @param token - Одноразовый токен сброса пароля (raw token).
   */
  async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const webUrl =
      this.configService.get<string>("app.webUrl") ??
      this.configService.get<string>("webUrl") ??
      "http://localhost:3000";

    const resetUrl = `${webUrl}/reset-password#token=${encodeURIComponent(token)}`;

    // TODO: Заменить на реальную отправку через NodemailerTransport / @packages/email
    // после развертывания почтового сервера (см. docs/tasks/email-service.md).
    // Сейчас используется mock-режим с логированием ссылки и токена в консоль.
    this.logger.log(
      `[MOCK EMAIL] Password reset requested for: ${email}\n` +
        `  -> Token: ${token}\n` +
        `  -> Reset URL: ${resetUrl}`,
    );
  }
}
