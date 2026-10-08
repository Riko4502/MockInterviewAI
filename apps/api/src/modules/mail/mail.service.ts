import { Inject, Injectable, Logger } from "@nestjs/common";
import { renderTemplate } from "@packages/email";
import type { Locale } from "@packages/i18n";
import type {
  EmailTemplateKey,
  IMailTransport,
  SendTemplateOptions,
} from "./interfaces";
import { MAIL_TRANSPORT_TOKEN } from "./mail.constants";

/**
 * Сервис отправки почтовых сообщений платформы MockInterviewAI.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(MAIL_TRANSPORT_TOKEN)
    private readonly transport: IMailTransport,
  ) {}

  /**
   * Рендерит и отправляет письмо по указанному React Email шаблону с поддержкой i18n.
   */
  async sendTemplate<K extends EmailTemplateKey>(
    options: SendTemplateOptions<K>,
  ): Promise<boolean> {
    const locale: Locale = options.locale ?? "ru";

    try {
      const rendered = await renderTemplate(
        options.template,
        options.props,
        locale,
      );

      const subject = options.subject ?? rendered.subject;

      await this.transport.send({
        to: options.to,
        subject,
        html: rendered.html,
        text: rendered.text,
      });

      this.logger.log(
        `Template "${options.template}" successfully sent to ${options.to}`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email template "${options.template}" to ${options.to}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return false;
    }
  }
}
