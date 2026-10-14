import * as fs from "node:fs/promises";
import type { ConfigService } from "@nestjs/config";
import * as nodemailer from "nodemailer";
import type { IMailTransport, SendMailOptions } from "./interfaces";
import { MailService } from "./mail.service";
import { DevLoggerTransport, NodemailerTransport } from "./transports";

jest.mock("nodemailer");
jest.mock("node:fs/promises");
jest.mock("@packages/email", () => {
  return {
    renderTemplate: jest
      .fn()
      .mockImplementation(async (template, props, locale) => {
        const texts = {
          "reset-password": {
            ru: "Сброс пароля",
            en: "Password Reset",
          },
          "verify-email": {
            ru: "Подтверждение email",
            en: "Verify Email",
          },
          "interview-scheduled": {
            ru: `Собеседование запланировано: ${props?.scheduledTime ?? ""}`,
            en: `Interview scheduled: ${props?.scheduledTime ?? ""}`,
          },
          "interview-reminder": {
            ru: `Напоминание: ${props?.minutesUntilStart ?? 0} минут`,
            en: `Reminder: ${props?.minutesUntilStart ?? 0} minutes`,
          },
          "security-alert": {
            ru: "Оповещение безопасности: Пароль был изменен",
            en: "Security Alert: Password Changed",
          },
        };

        const lang = locale === "en" ? "en" : "ru";
        const subject =
          texts[template as keyof typeof texts]?.[lang] ?? "Тема письма";

        return {
          html: `<html lang="${lang}">${JSON.stringify(props ?? {})}</html>`,
          text: `text:${JSON.stringify(props ?? {})}`,
          subject,
        };
      }),
  };
});

describe("MailModule Unit Tests", () => {
  describe("MailService", () => {
    let service: MailService;
    let transportMock: jest.Mocked<IMailTransport>;

    beforeEach(() => {
      transportMock = {
        send: jest.fn().mockResolvedValue(undefined),
      };

      service = new MailService(transportMock);
    });

    it("sendTemplate('reset-password'): генерирует тему из русской локали по умолчанию и передает html/text в транспорт", async () => {
      await service.sendTemplate({
        to: "user@example.com",
        template: "reset-password",
        props: {
          username: "Алексей",
          resetUrl: "https://mockinterview.ai/reset-password#token=xyz123",
          expiresMinutes: 15,
        },
      });

      expect(transportMock.send).toHaveBeenCalledTimes(1);
      const options = transportMock.send.mock.calls[0][0];

      expect(options.to).toBe("user@example.com");
      expect(options.subject).toBe("Сброс пароля");
      expect(options.html).toContain("Алексей");
      expect(options.html).toContain(
        "https://mockinterview.ai/reset-password#token=xyz123",
      );
      expect(options.text).toContain("Алексей");
      expect(options.text).toContain(
        "https://mockinterview.ai/reset-password#token=xyz123",
      );
    });

    it("sendTemplate с указанием locale: 'en': использует английские тексты и тему", async () => {
      await service.sendTemplate({
        to: "john@example.com",
        template: "reset-password",
        props: {
          username: "John",
          resetUrl: "https://mockinterview.ai/reset-password#token=abc",
          expiresMinutes: 15,
        },
        locale: "en",
      });

      expect(transportMock.send).toHaveBeenCalledTimes(1);
      const options = transportMock.send.mock.calls[0][0];

      expect(options.to).toBe("john@example.com");
      expect(options.subject).toBe("Password Reset");
      expect(options.html).toContain("John");
      expect(options.text).toContain("John");
    });

    it("sendTemplate с явным subject: использует переданную тему вместо дефолтной", async () => {
      await service.sendTemplate({
        to: "user@example.com",
        template: "verify-email",
        props: {
          username: "Пользователь",
          verifyUrl: "https://mockinterview.ai/verify?token=123",
          expiresMinutes: 15,
        },
        subject: "Кастомная тема подтверждения",
      });

      expect(transportMock.send).toHaveBeenCalledTimes(1);
      const options = transportMock.send.mock.calls[0][0];
      expect(options.subject).toBe("Кастомная тема подтверждения");
    });

    it("sendTemplate('interview-scheduled'): подставляет scheduledTime в тему письма", async () => {
      await service.sendTemplate({
        to: "partner@example.com",
        template: "interview-scheduled",
        props: {
          partnerName: "Дмитрий",
          scheduledTime: "12 октября в 18:00",
          roomUrl: "https://mockinterview.ai/room/123",
        },
      });

      expect(transportMock.send).toHaveBeenCalledTimes(1);
      const options = transportMock.send.mock.calls[0][0];
      expect(options.subject).toContain("12 октября в 18:00");
    });

    it("sendTemplate('interview-reminder'): подставляет minutesUntilStart в тему письма", async () => {
      await service.sendTemplate({
        to: "partner@example.com",
        template: "interview-reminder",
        props: {
          partnerName: "Дмитрий",
          minutesUntilStart: 15,
          roomUrl: "https://mockinterview.ai/room/123",
        },
      });

      expect(transportMock.send).toHaveBeenCalledTimes(1);
      const options = transportMock.send.mock.calls[0][0];
      expect(options.subject).toContain("15");
    });

    it("sendTemplate('security-alert'): подставляет заголовок события в тему письма", async () => {
      await service.sendTemplate({
        to: "security@example.com",
        template: "security-alert",
        props: {
          eventType: "PASSWORD_CHANGED",
          ipAddress: "127.0.0.1",
          timestamp: "2026-10-08 12:00:00",
        },
      });

      expect(transportMock.send).toHaveBeenCalledTimes(1);
      const options = transportMock.send.mock.calls[0][0];
      expect(options.subject).toContain("Оповещение безопасности");
    });

    it("сбой транспорта: перехватывает ошибку, логирует и не крашит вызывающий процесс (graceful fallback)", async () => {
      transportMock.send.mockRejectedValueOnce(
        new Error("SMTP Connection refused"),
      );

      const result = await service.sendTemplate({
        to: "user@example.com",
        template: "reset-password",
        props: {
          username: "User",
          resetUrl: "https://link",
          expiresMinutes: 15,
        },
      });

      expect(result).toBe(false);
      expect(transportMock.send).toHaveBeenCalledTimes(1);
    });
  });

  describe("DevLoggerTransport", () => {
    let transport: DevLoggerTransport;

    beforeEach(() => {
      jest.clearAllMocks();
      transport = new DevLoggerTransport();
    });

    it("send: логирует превью и сохраняет html файл на диск", async () => {
      const mockMail: SendMailOptions = {
        to: "test@example.com",
        subject: "Тестовая тема",
        html: "<h1>Привет</h1>",
        text: "Привет...",
      };

      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      (fs.readdir as jest.Mock).mockResolvedValue([]);

      await transport.send(mockMail);

      expect(fs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining(".mail-preview"),
        { recursive: true },
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining(".mail-preview"),
        mockMail.html,
        "utf-8",
      );
    });

    it("send: ошибка записи на диск не ломает выполнение", async () => {
      const mockMail: SendMailOptions = {
        to: "test@example.com",
        subject: "Тест ошибки",
        html: "<p>Ошибка</p>",
        text: "Ошибка...",
      };

      (fs.mkdir as jest.Mock).mockRejectedValueOnce(
        new Error("Disk permission denied"),
      );

      await expect(transport.send(mockMail)).resolves.not.toThrow();
    });
  });

  describe("NodemailerTransport", () => {
    let transport: NodemailerTransport;
    let sendMailMock: jest.Mock;
    let configServiceMock: jest.Mocked<ConfigService>;

    beforeEach(() => {
      jest.clearAllMocks();

      sendMailMock = jest.fn().mockResolvedValue({ messageId: "msg-12345" });

      (nodemailer.createTransport as jest.Mock).mockReturnValue({
        sendMail: sendMailMock,
      });

      configServiceMock = {
        getOrThrow: jest.fn().mockReturnValue({
          transport: "smtp",
          host: "smtp.mock.com",
          port: 587,
          secure: false,
          user: "user",
          password: "password",
          from: "noreply@mockinterview.ai",
        }),
      } as unknown as jest.Mocked<ConfigService>;

      transport = new NodemailerTransport(configServiceMock);
    });

    it("инициализирует transporter с переданными из конфига параметрами", () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.mock.com",
        port: 587,
        secure: false,
        auth: {
          user: "user",
          pass: "password",
        },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      });
    });

    it("send: отправляет письмо через transporter.sendMail", async () => {
      const options: SendMailOptions = {
        to: "receiver@example.com",
        subject: "Тест SMTP",
        html: "<b>SMTP test</b>",
        text: "SMTP test",
      };

      await transport.send(options);

      expect(sendMailMock).toHaveBeenCalledWith({
        from: "noreply@mockinterview.ai",
        to: "receiver@example.com",
        subject: "Тест SMTP",
        html: "<b>SMTP test</b>",
        text: "SMTP test",
      });
    });

    it("send: при ошибке transporter выбрасывает исключение", async () => {
      sendMailMock.mockRejectedValueOnce(new Error("SMTP server down"));

      await expect(
        transport.send({
          to: "receiver@example.com",
          subject: "Тест SMTP",
          html: "<b>SMTP test</b>",
          text: "SMTP test",
        }),
      ).rejects.toThrow("SMTP server down");
    });
  });
});
