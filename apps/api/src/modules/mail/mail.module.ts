import { Module } from "@nestjs/common";
import { MailService } from "./mail.service";

/**
 * Модуль отправки почты.
 */
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule {}
