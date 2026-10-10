import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Config } from "../../config/configuration";
import { MAIL_TRANSPORT_TOKEN } from "./mail.constants";
import { MailService } from "./mail.service";
import { DevLoggerTransport, NodemailerTransport } from "./transports";

// useFactory - фабрика, т.е функция которая запускается один раз при старте приложения Nest и создает экземпляр транспорта

/**
 * Модуль почтовых отправлений.
 * Регистрирует MailService и выбирает транспорт в зависимости от конфигурации окружения.
 */
@Module({
  providers: [
    MailService,
    {
      provide: MAIL_TRANSPORT_TOKEN,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const mailConfig = configService.getOrThrow<Config["mail"]>("mail");

        if (mailConfig.transport === "smtp") {
          return new NodemailerTransport(configService);
        }

        return new DevLoggerTransport();
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
