import { HttpStatus } from "@nestjs/common";
import { IS_PUBLIC_KEY } from "../../common/decorators/public.decorator";
import { AuthThrottlerGuard } from "../auth/guards/auth-throttler.guard";
import { InternalServiceKeyGuard } from "./guards/internal-service-key.guard";
import { TelegramController } from "./telegram.controller";
import type { TelegramService } from "./telegram.service";

describe("TelegramController", () => {
  let serviceMock: { [K in keyof TelegramService]: jest.Mock };
  let controller: TelegramController;

  const CHAT_ID = "123456789";
  const TOKEN = "a".repeat(48);

  const mockProfile = {
    id: "11111111-1111-4111-a111-111111111111",
    email: "user@example.com",
    displayName: "John Doe",
    username: "johndoe",
    telegramUsername: "@johndoe",
    telegramChatId: CHAT_ID,
    telegramLocale: "ru",
    role: "USER",
  };

  beforeEach(() => {
    serviceMock = {
      createLinkToken: jest.fn().mockResolvedValue({
        linkUrl: `https://t.me/MockInterviewBot?start=${TOKEN}`,
      }),
      link: jest.fn().mockResolvedValue(mockProfile),
      unlink: jest.fn().mockResolvedValue({ success: true }),
      getProfileByChatId: jest.fn().mockResolvedValue(mockProfile),
      getInterviewsByChatId: jest.fn().mockResolvedValue({ items: [] }),
      updatePreferences: jest.fn().mockResolvedValue(mockProfile),
    } as unknown as { [K in keyof TelegramService]: jest.Mock };

    controller = new TelegramController(
      serviceMock as unknown as TelegramService,
    );
  });

  function guardsOf(method: string): unknown[] {
    return Reflect.getMetadata(
      "__guards__",
      TelegramController.prototype[method as keyof TelegramController],
    ) as unknown[];
  }

  function isPublic(method: string): boolean {
    return (
      Reflect.getMetadata(
        IS_PUBLIC_KEY,
        TelegramController.prototype[method as keyof TelegramController],
      ) === true
    );
  }

  describe("link-token", () => {
    it("НЕ помечен @Public() — защищён глобальным AccessTokenGuard", () => {
      expect(isPublic("createLinkToken")).toBe(false);
    });

    it("применён AuthThrottlerGuard (per-route лимит)", () => {
      expect(guardsOf("createLinkToken")).toContain(AuthThrottlerGuard);
    });

    it("вызывает сервис с userId текущего пользователя", async () => {
      const result = await controller.createLinkToken(
        "11111111-1111-4111-a111-111111111111",
      );
      expect(serviceMock.createLinkToken).toHaveBeenCalledWith(
        "11111111-1111-4111-a111-111111111111",
      );
      expect(result.linkUrl).toBe(
        `https://t.me/MockInterviewBot?start=${TOKEN}`,
      );
    });
  });

  describe("service-key endpoints", () => {
    it("link помечен @Public() + InternalServiceKeyGuard", () => {
      expect(isPublic("link")).toBe(true);
      expect(guardsOf("link")).toContain(InternalServiceKeyGuard);
    });

    it("unlink помечен @Public() + InternalServiceKeyGuard", () => {
      expect(isPublic("unlink")).toBe(true);
      expect(guardsOf("unlink")).toContain(InternalServiceKeyGuard);
    });

    it("profile помечен @Public() + InternalServiceKeyGuard", () => {
      expect(isPublic("profile")).toBe(true);
      expect(guardsOf("profile")).toContain(InternalServiceKeyGuard);
    });

    it("interviews помечен @Public() + InternalServiceKeyGuard", () => {
      expect(isPublic("interviews")).toBe(true);
      expect(guardsOf("interviews")).toContain(InternalServiceKeyGuard);
    });

    it("preferences помечен @Public() + InternalServiceKeyGuard", () => {
      expect(isPublic("preferences")).toBe(true);
      expect(guardsOf("preferences")).toContain(InternalServiceKeyGuard);
    });

    it("@HttpCode(200) на link (SPEC §6.2)", () => {
      const httpCode = Reflect.getMetadata(
        "__httpCode__",
        TelegramController.prototype.link,
      );
      expect(httpCode).toBe(HttpStatus.OK);
    });
  });

  describe("handlers", () => {
    it("link → сервис с token и chatId", async () => {
      const result = await controller.link({ token: TOKEN, chatId: CHAT_ID });
      expect(serviceMock.link).toHaveBeenCalledWith(TOKEN, CHAT_ID);
      expect(result.telegramChatId).toBe(CHAT_ID);
    });

    it("unlink → сервис с chatId", async () => {
      const result = await controller.unlink({ chatId: CHAT_ID });
      expect(serviceMock.unlink).toHaveBeenCalledWith(CHAT_ID);
      expect(result).toEqual({ success: true });
    });

    it("profile → сервис с chatId из query", async () => {
      const result = await controller.profile({ chatId: CHAT_ID });
      expect(serviceMock.getProfileByChatId).toHaveBeenCalledWith(CHAT_ID);
      expect(result.telegramChatId).toBe(CHAT_ID);
    });

    it("interviews → сервис с chatId из query", async () => {
      const result = await controller.interviews({ chatId: CHAT_ID });
      expect(serviceMock.getInterviewsByChatId).toHaveBeenCalledWith(CHAT_ID);
      expect(result).toEqual({ items: [] });
    });

    it("preferences → сервис с chatId и locale", async () => {
      const result = await controller.preferences({
        chatId: CHAT_ID,
        locale: "en",
      });
      expect(serviceMock.updatePreferences).toHaveBeenCalledWith(CHAT_ID, "en");
      expect(result.telegramLocale).toBe("ru");
    });
  });
});
