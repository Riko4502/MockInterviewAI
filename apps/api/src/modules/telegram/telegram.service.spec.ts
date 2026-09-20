import { createHash } from "node:crypto";
import {
  ConflictException,
  GoneException,
  NotFoundException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { TelegramService } from "./telegram.service";

const CONFIG_MOCK = {
  get: (key: string) => {
    if (key === "telegram.botUsername") return "MockInterviewBot";
    if (key === "telegram.linkTtlSeconds") return 900;
    return undefined;
  },
} as unknown as ConfigService;

const USER_ID = "11111111-1111-4111-a111-111111111111";
const CHAT_ID = "123456789";
const LOCALE_RU = "ru";

function mockUser(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: USER_ID,
    email: "user@example.com",
    passwordHash: "argon2id$hashed",
    displayName: "John Doe",
    username: "johndoe",
    avatarUrl: null,
    telegramUsername: "@johndoe",
    telegramChatId: null,
    telegramLocale: null,
    roleId: null,
    role: { slug: "USER" },
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("TelegramService", () => {
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
      update: jest.Mock;
      updateMany: jest.Mock;
    };
    interviewSession: { findMany: jest.Mock };
  };
  let redisMock: {
    set: jest.Mock;
    getdel: jest.Mock;
  };
  let service: TelegramService;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      interviewSession: { findMany: jest.fn() },
    };
    redisMock = {
      set: jest.fn().mockResolvedValue(undefined),
      getdel: jest.fn(),
    };

    service = new TelegramService(
      prismaMock as unknown as PrismaService,
      redisMock as unknown as RedisService,
      CONFIG_MOCK,
    );
  });

  describe("createLinkToken", () => {
    it("генерирует hex-токен ≤64 символов и хранит sha256(rawToken) в Redis с TTL", async () => {
      const { linkUrl } = await service.createLinkToken(USER_ID);

      const rawToken = linkUrl.split("?start=")[1];
      expect(rawToken).toMatch(/^[0-9a-f]{48}$/);
      expect(linkUrl).toBe(`https://t.me/MockInterviewBot?start=${rawToken}`);

      expect(redisMock.set).toHaveBeenCalledWith(
        `tg:link:${sha256(rawToken)}`,
        JSON.stringify({ userId: USER_ID }),
        900,
      );
    });
  });

  describe("link", () => {
    const TOKEN = "a".repeat(48);

    it("успех: GETDEL токена, привязка chatId и очистка локали", async () => {
      redisMock.getdel.mockResolvedValue(JSON.stringify({ userId: USER_ID }));
      prismaMock.user.findUnique.mockResolvedValue(mockUser());
      prismaMock.user.update.mockResolvedValue(
        mockUser({ telegramChatId: CHAT_ID }),
      );

      const result = await service.link(TOKEN, CHAT_ID);

      expect(redisMock.getdel).toHaveBeenCalledWith(`tg:link:${sha256(TOKEN)}`);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { telegramChatId: CHAT_ID, telegramLocale: null },
        include: { role: true },
      });
      expect(result.telegramChatId).toBe(CHAT_ID);
      expect(result.role).toBe("USER");
    });

    it("токен не найден (GETDEL → null) → 410", async () => {
      redisMock.getdel.mockResolvedValue(null);
      await expect(service.link(TOKEN, CHAT_ID)).rejects.toThrow(GoneException);
    });

    it("повторное использование токена (GETDEL → null) → 410", async () => {
      redisMock.getdel.mockResolvedValue(null);
      await expect(service.link(TOKEN, CHAT_ID)).rejects.toThrow(GoneException);
    });

    it("chatId уже занят другим пользователем (P2002) → 409", async () => {
      redisMock.getdel.mockResolvedValue(JSON.stringify({ userId: USER_ID }));
      prismaMock.user.findUnique.mockResolvedValue(mockUser());
      prismaMock.user.update.mockRejectedValue(
        Object.assign(new Error("unique constraint"), { code: "P2002" }),
      );

      await expect(service.link(TOKEN, CHAT_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it("аккаунт soft-deleted → 410", async () => {
      redisMock.getdel.mockResolvedValue(JSON.stringify({ userId: USER_ID }));
      prismaMock.user.findUnique.mockResolvedValue(
        mockUser({ deletedAt: new Date("2026-02-01T00:00:00Z") }),
      );

      await expect(service.link(TOKEN, CHAT_ID)).rejects.toThrow(GoneException);
    });

    it("у пользователя уже задан telegramChatId → 409", async () => {
      redisMock.getdel.mockResolvedValue(JSON.stringify({ userId: USER_ID }));
      prismaMock.user.findUnique.mockResolvedValue(
        mockUser({ telegramChatId: "987654321" }),
      );

      await expect(service.link(TOKEN, CHAT_ID)).rejects.toThrow(
        ConflictException,
      );
    });

    it("невалидный JSON в Redis → 410", async () => {
      redisMock.getdel.mockResolvedValue("not-json");
      await expect(service.link(TOKEN, CHAT_ID)).rejects.toThrow(GoneException);
    });
  });

  describe("unlink", () => {
    it("успех: очистка telegramChatId и telegramLocale", async () => {
      prismaMock.user.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.unlink(CHAT_ID);

      expect(prismaMock.user.updateMany).toHaveBeenCalledWith({
        where: { telegramChatId: CHAT_ID },
        data: { telegramChatId: null, telegramLocale: null },
      });
      expect(result).toEqual({ success: true });
    });

    it("чат не привязан (count 0) → 404", async () => {
      prismaMock.user.updateMany.mockResolvedValue({ count: 0 });
      await expect(service.unlink(CHAT_ID)).rejects.toThrow(NotFoundException);
    });

    it("повторный unlink после успеха → 404 (идемпотентно-безопасно)", async () => {
      prismaMock.user.updateMany
        .mockResolvedValueOnce({ count: 1 })
        .mockResolvedValueOnce({ count: 0 });

      await expect(service.unlink(CHAT_ID)).resolves.toEqual({
        success: true,
      });
      await expect(service.unlink(CHAT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe("getProfileByChatId", () => {
    it("успех: возвращает профиль с нормализованной локалью", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        mockUser({ telegramChatId: CHAT_ID, telegramLocale: LOCALE_RU }),
      );

      const result = await service.getProfileByChatId(CHAT_ID);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { telegramChatId: CHAT_ID },
        include: { role: true },
      });
      expect(result.telegramChatId).toBe(CHAT_ID);
      expect(result.telegramLocale).toBe(LOCALE_RU);
    });

    it("локаль не задана → null", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        mockUser({ telegramChatId: CHAT_ID, telegramLocale: null }),
      );

      const result = await service.getProfileByChatId(CHAT_ID);
      expect(result.telegramLocale).toBeNull();
    });

    it("пользователь не найден → 404", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.getProfileByChatId(CHAT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("soft-deleted аккаунт → 404", async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        mockUser({ deletedAt: new Date() }),
      );
      await expect(service.getProfileByChatId(CHAT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("getInterviewsByChatId", () => {
    it("пользователь не найден → 404", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.getInterviewsByChatId(CHAT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("пустой список предстоящих сессий", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID });
      prismaMock.interviewSession.findMany.mockResolvedValue([]);

      const result = await service.getInterviewsByChatId(CHAT_ID);
      expect(result).toEqual({ items: [] });
    });

    it("владелец → роль INTERVIEWER, участник → роль из InterviewParticipant", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID });
      prismaMock.interviewSession.findMany.mockResolvedValue([
        {
          id: "22222222-2222-4222-a222-222222222222",
          userId: USER_ID,
          status: "ACTIVE",
          startedAt: new Date("2026-09-17T10:00:00Z"),
          createdAt: new Date("2026-09-16T12:00:00Z"),
          participants: [
            { userId: USER_ID, role: "INTERVIEWER" },
            {
              userId: "33333333-3333-4333-a333-333333333333",
              role: "CANDIDATE",
            },
          ],
        },
        {
          id: "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa",
          userId: "33333333-3333-4333-a333-333333333333",
          status: "CREATED",
          startedAt: null,
          createdAt: new Date("2026-09-15T12:00:00Z"),
          participants: [
            { userId: USER_ID, role: "CANDIDATE" },
            {
              userId: "33333333-3333-4333-a333-333333333333",
              role: "INTERVIEWER",
            },
          ],
        },
      ]);

      const result = await service.getInterviewsByChatId(CHAT_ID);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        status: "ACTIVE",
        role: "INTERVIEWER",
      });
      expect(result.items[1].role).toBe("CANDIDATE");
      expect(prismaMock.interviewSession.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { userId: USER_ID },
            { participants: { some: { userId: USER_ID } } },
          ],
          status: { in: ["CREATED", "ACTIVE"] },
        },
        include: { participants: true },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
    });
  });

  describe("updatePreferences", () => {
    it("успех: сохраняет локаль и возвращает профиль", async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: USER_ID });
      prismaMock.user.update.mockResolvedValue(
        mockUser({ telegramChatId: CHAT_ID, telegramLocale: "en" }),
      );

      const result = await service.updatePreferences(CHAT_ID, "en");

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: USER_ID },
        data: { telegramLocale: "en" },
        include: { role: true },
      });
      expect(result.telegramLocale).toBe("en");
    });

    it("пользователь не найден → 404", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(
        service.updatePreferences(CHAT_ID, LOCALE_RU),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
