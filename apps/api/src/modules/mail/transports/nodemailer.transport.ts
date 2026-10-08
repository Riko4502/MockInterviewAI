// transport для продакшена

import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import { Config } from "../../../config/configuration";
import type { IMailTransport, SendMailOptions } from "../interfaces";

/**
 * Транспорт отправки почты через реальный SMTP сервер с использованием Nodemailer.
 * Используется в средах staging и production.
 */
@Injectable()
export class NodemailerTransport implements IMailTransport {
  private readonly logger = new Logger(NodemailerTransport.name);
  private readonly transporter: nodemailer.Transporter;
  private readonly defaultFrom: string;

  constructor(private readonly configService: ConfigService) {
    // Берём готовую валидированную секцию mail целиком из единого источника правды:
    const mailConfig = this.configService.getOrThrow<Config["mail"]>("mail");

    this.defaultFrom = mailConfig.from;

    this.transporter = nodemailer.createTransport({
      host: mailConfig.host,
      port: mailConfig.port,
      secure: mailConfig.secure,
      auth: mailConfig.user
        ? {
            user: mailConfig.user,
            pass: mailConfig.password,
          }
        : undefined,
    });
  }

  /**
   * Отправляет сформированное письмо получателю по протоколу SMTP.
   */
  async send(options: SendMailOptions): Promise<void> {
    try {
      const info = await this.transporter.sendMail({
        from: options.from ?? this.defaultFrom,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      this.logger.log(
        `Email successfully sent to ${options.to} (MessageId: ${info.messageId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
