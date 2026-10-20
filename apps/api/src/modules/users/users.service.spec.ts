import { createHash } from "node:crypto";
import {
  BadRequestException,
  ConflictException,
  GoneException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  type CompleteOnboardingDto,
  SECURITY_UNLINK_ERROR_CODES,
} from "@packages/dto";
import { SystemPermission, SystemRole } from "@packages/types";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import type { AuthSessionService } from "../auth/services/auth-session.service";
import type { NotificationDispatcher } from "../notifications/notification-dispatcher.service";
import type { RabbitMqPublisher } from "../notifications/rabbitmq-publisher.service";
import type { SecurityEventsService } from "../security-events/security-events.service";
import type { StorageService } from "../storage/storage.service";
import { UsersService } from "./users.service";

/**
 * Проверяет, что промис отклоняется `HttpException` с ожидаемым статусом и
 * серверным `code` в теле — именно его фронт мапит на i18n-ключ (F7), а не
 * текст сообщения.
 */
async function expectErrorCode(
  promise: Promise<unknown>,
  status: number,
  code: string,
): Promise<void> {
  let caught: unknown;
  try {
    await promise;
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(HttpException);
  const ex = caught as HttpException;
  expect(ex.getStatus()).toBe(status);
  expect(ex.getResponse()).toEqual(expect.objectContaining({ code }));
}

describe("UsersService", () => {
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    userDeviceSettings: {
      findUnique: jest.Mock;
      findMany: jest.Mock;
      upsert: jest.Mock;
      deleteMany: jest.Mock;
    };
    role: {
      findUnique: jest.Mock;
    };
    authRevocationTask: {
      create: jest.Mock;
      delete: jest.Mock;
    };
    notificationOutbox: {
      create: jest.Mock;
    };
    securityEvent: {
      create: jest.Mock;
    };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
  };
  let storageServiceMock: jest.Mocked<Partial<StorageService>>;
  // Явная форма моков: `jest.Mocked<Partial<RedisService>>` не даёт
  // `.mockResolvedValue` для методов с перегрузками (`eval`).
  let redisServiceMock: {
    get: jest.Mock;
    set: jest.Mock;
    compareAndDelete: jest.Mock;
    eval: jest.Mock;
    publish: jest.Mock;
    delete: jest.Mock;
  };
  let authSessionServiceMock: {
    revokeAllUserSessions: jest.Mock;
  };
  let notificationDispatcherMock: {
    dispatch: jest.Mock;
  };
  let securityEventsServiceMock: {
    record: jest.Mock;
  };
  let rabbitMqPublisherMock: {
    publish: jest.Mock;
  };
  let service: UsersService;

  const mockUser = {
    id: "11111111-1111-4111-a111-111111111111",
    email: "test@example.com",
    passwordHash: "argon2id$hashed",
    displayName: "Ivan Ivanov",
    username: "ivan_dev",
    avatarUrl: "https://example.com/avatar.webp",
    telegramUsername: "ivan_tg",
    telegramLinkVerified: false,
    gitUrl: "https://github.com/ivan_dev",
    theme: "DARK",
    locale: "ru",
    timezone: "Europe/Moscow",
    role: { slug: SystemRole.USER, permissions: SystemPermission.USERS_READ },
    deletedAt: null,
    generation: 1,
    onboardingCompleted: false,
    targetRole: null,
    targetLevel: null,
    targetCompanies: [] as string[],
    targetTimeline: null,
    preferredFormat: null,
    onboardingAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn().mockResolvedValue({ ...mockUser, generation: 2 }),
      },
      role: {
        findUnique: jest.fn().mockResolvedValue({
          id: "00000000-0000-4000-a000-000000000002",
          slug: SystemRole.USER,
          permissions: SystemPermission.USERS_READ,
        }),
      },
      authRevocationTask: {
        create: jest.fn().mockResolvedValue({
          id: "task-1",
          createdAt: new Date("2026-09-10T12:00:00.000Z"),
        }),
        delete: jest.fn().mockResolvedValue({}),
      },
      notificationOutbox: {
        create: jest.fn().mockResolvedValue({
          id: "outbox-1",
          type: "system.welcome",
          recipientId: mockUser.id,
          status: "PENDING",
        }),
      },
      securityEvent: {
        create: jest.fn().mockResolvedValue({
          id: "security-event-1",
          createdAt: new Date("2026-09-10T12:00:00.000Z"),
        }),
      },
      userDeviceSettings: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        upsert: jest.fn(),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([{ id: mockUser.id }]),
      $transaction: jest.fn().mockImplementation((arg) => {
        if (typeof arg === "function") {
          return arg(prismaMock);
        }
        return Promise.all(arg);
      }),
    };
    storageServiceMock = {
      uploadAvatar: jest
        .fn()
        .mockResolvedValue("https://example.com/new_avatar.webp"),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    redisServiceMock = {
      delete: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(1),
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      compareAndDelete: jest.fn(),
      eval: jest.fn(),
    };
    authSessionServiceMock = {
      revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
    };
    notificationDispatcherMock = {
      dispatch: jest.fn().mockResolvedValue({ id: "outbox-1" }),
    };
    securityEventsServiceMock = {
      record: jest.fn().mockResolvedValue({
        id: "security-event-1",
        createdAt: new Date("2026-09-10T12:00:00.000Z"),
      }),
    };
    rabbitMqPublisherMock = {
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      prismaMock as unknown as PrismaService,
      storageServiceMock as unknown as StorageService,
      redisServiceMock as unknown as RedisService,
      authSessionServiceMock as unknown as AuthSessionService,
      notificationDispatcherMock as unknown as NotificationDispatcher,
      securityEventsServiceMock as unknown as SecurityEventsService,
      rabbitMqPublisherMock as unknown as RabbitMqPublisher,
    );
  });

  describe("create", () => {
    it("создаёт нового пользователя с ID найденной роли", async () => {
      prismaMock.user.create.mockResolvedValue(mockUser);

      const result = await service.create({
        email: "test@example.com",
        passwordHash: "argon2id$hashed",
      });

      expect(result).toEqual(mockUser);
      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: "test@example.com",
          passwordHash: "argon2id$hashed",
          roleId: "00000000-0000-4000-a000-000000000002",
        },
      });
    });

    it("выбрасывает InternalServerErrorException если роль не найдена", async () => {
      prismaMock.role.findUnique.mockResolvedValue(null);

      await expect(
        service.create({
          email: "test@example.com",
          passwordHash: "argon2id$hashed",
        }),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it("пишет system.welcome в outbox в той же транзакции", async () => {
      prismaMock.user.create.mockResolvedValue(mockUser);

      await service.create({
        email: "test@example.com",
        passwordHash: "argon2id$hashed",
      });

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      // Ключевой инвариант: диспетчер получает именно транзакционный клиент,
      // а не this.prisma. Иначе строка outbox ушла бы в отдельную транзакцию и
      // пережила бы откат регистрации (ADR-003:65-68).
      expect(notificationDispatcherMock.dispatch).toHaveBeenCalledWith(
        { type: "system.welcome", payload: {} },
        mockUser.id,
        prismaMock,
      );
    });

    it("не создаёт пользователя, если диспетчер упал", async () => {
      prismaMock.user.create.mockResolvedValue(mockUser);
      notificationDispatcherMock.dispatch.mockRejectedValue(
        new Error("outbox unavailable"),
      );

      await expect(
        service.create({
          email: "test@example.com",
          passwordHash: "argon2id$hashed",
        }),
      ).rejects.toThrow("outbox unavailable");
    });
  });

  describe("getProfile", () => {
    it("возвращает профиль пользователя без passwordHash с ролью и ненулевой маской", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getProfile(mockUser.id);

      const {
        passwordHash: _,
        deletedAt: __,
        generation: ___,
        createdAt: ____,
        updatedAt: _____,
        theme: _______,
        ...safeProfile
      } = mockUser;
      expect(result).toEqual({
        ...safeProfile,
        theme: "dark",
        createdAt: mockUser.createdAt.toISOString(),
        updatedAt: mockUser.updatedAt.toISOString(),
        role: SystemRole.USER,
        permissions: SystemPermission.USERS_READ.toString(),
        telegramLinkVerified: false,
        githubLinkVerified: false,
      });
      expect(result).not.toHaveProperty("passwordHash");
      expect(result).not.toHaveProperty("deletedAt");
      expect(result).not.toHaveProperty("generation");
    });

    it("выбрасывает NotFoundException если профиль не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getProfile("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("updateProfile", () => {
    it("успешно обновляет профиль пользователя", async () => {
      const updatedProfile = {
        ...mockUser,
        displayName: "New Name",
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.findFirst.mockResolvedValue(null);
      prismaMock.user.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(mockUser.id, {
        displayName: "New Name",
      });

      expect(result.displayName).toBe("New Name");
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it("успешно обновляет тему и язык пользователя", async () => {
      const updatedProfile = {
        ...mockUser,
        theme: "LIGHT",
        locale: "en",
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(mockUser.id, {
        theme: "light",
        locale: "en",
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            theme: "LIGHT",
            locale: "en",
          }),
        }),
      );
      expect(result.theme).toBe("light");
      expect(result.locale).toBe("en");
    });

    it("сохраняет IANA-таймзону пользователя", async () => {
      const updatedProfile = {
        ...mockUser,
        timezone: "Asia/Tokyo",
      };
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(mockUser.id, {
        timezone: "Asia/Tokyo",
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            timezone: "Asia/Tokyo",
          }),
        }),
      );
      expect(result.timezone).toBe("Asia/Tokyo");
    });

    it("D2: отклоняет отвязку telegramUsername: null через PATCH с 400", async () => {
      const userWithTg = {
        ...mockUser,
        telegramId: BigInt(123456789),
        telegramChatId: "987654321",
        telegramLinkVerified: true,
      };
      prismaMock.user.findUnique.mockResolvedValue(userWithTg);

      await expect(
        service.updateProfile(userWithTg.id, {
          telegramUsername: null,
        }),
      ).rejects.toThrow(BadRequestException);

      // Отвязка только отдельным эндпоинтом — PATCH не должен писать в БД.
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("D2: отклоняет отвязку gitUrl: null через PATCH с 400", async () => {
      const userWithGithub = {
        ...mockUser,
        githubId: "gh-123",
        gitUrl: "https://github.com/ivan_dev",
      };
      prismaMock.user.findUnique.mockResolvedValue(userWithGithub);

      await expect(
        service.updateProfile(userWithGithub.id, {
          gitUrl: null,
        }),
      ).rejects.toThrow(BadRequestException);

      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("выбрасывает BadRequestException при попытке ручной установки telegramUsername без верифицированной привязки", async () => {
      const userWithoutTg = {
        ...mockUser,
        telegramLinkVerified: false,
      };
      prismaMock.user.findUnique.mockResolvedValue(userWithoutTg);

      await expect(
        service.updateProfile(userWithoutTg.id, {
          telegramUsername: "new_username",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("выбрасывает BadRequestException при попытке ручной установки gitUrl без привязанного githubId", async () => {
      const userWithoutGithub = {
        ...mockUser,
        githubId: null,
      };
      prismaMock.user.findUnique.mockResolvedValue(userWithoutGithub);

      await expect(
        service.updateProfile(userWithoutGithub.id, {
          gitUrl: "https://github.com/manual_dev",
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("выбрасывает ConflictException при попытке занять чужой username", async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({
          id: "another-user-id",
          username: "taken_username",
        });

      await expect(
        service.updateProfile(mockUser.id, { username: "taken_username" }),
      ).rejects.toThrow(ConflictException);
    });

    it("выбрасывает NotFoundException если обновляемый пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile("non-existent-id", { displayName: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("completeOnboarding", () => {
    it("успешно завершает онбординг и инвалидирует кэш готовности", async () => {
      const dto: CompleteOnboardingDto = {
        role: "FRONTEND",
        level: "MIDDLE",
        companies: ["yandex", "tinkoff"],
        timeline: "soon",
        format: "ai",
        isSkipped: false,
      };
      const updatedUser = {
        ...mockUser,
        onboardingCompleted: true,
        targetRole: dto.role,
        targetLevel: dto.level,
        targetCompanies: dto.companies,
        targetTimeline: dto.timeline,
        preferredFormat: dto.format,
        onboardingAt: new Date("2026-10-03T12:00:00Z"),
      };

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue(updatedUser);

      const result = await service.completeOnboarding(mockUser.id, dto);

      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUser.id },
          data: expect.objectContaining({
            onboardingCompleted: true,
            targetRole: "FRONTEND",
            targetLevel: "MIDDLE",
            targetCompanies: ["yandex", "tinkoff"],
            targetTimeline: "soon",
            preferredFormat: "ai",
          }),
        }),
      );
      expect(result.onboardingCompleted).toBe(true);
      expect(result.targetRole).toBe("FRONTEND");
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        `cache:dashboard:readiness:${mockUser.id}`,
      );
    });

    it("выбрасывает NotFoundException если пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.completeOnboarding("non-existent-id", {
          role: "FRONTEND",
          companies: [],
          isSkipped: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateAvatar and deleteAvatar", () => {
    it("загружает новый аватар, сохраняет в БД и удаляет старый", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        avatarUrl: "https://example.com/new_avatar.webp",
      });

      const mockFile = {
        buffer: Buffer.from("fake-image"),
        mimetype: "image/png",
      } as Express.Multer.File;

      const result = await service.updateAvatar(mockUser.id, mockFile);

      expect(result).toEqual({
        avatarUrl: "https://example.com/new_avatar.webp",
      });
      expect(storageServiceMock.uploadAvatar).toHaveBeenCalledWith(
        mockUser.id,
        mockFile,
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { avatarUrl: "https://example.com/new_avatar.webp" },
      });
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        mockUser.avatarUrl,
      );
    });

    it("удаляет текущий аватар из S3 и обнуляет в БД", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        avatarUrl: null,
      });

      await service.deleteAvatar(mockUser.id);

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        mockUser.avatarUrl,
      );
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { avatarUrl: null },
      });
    });
  });

  describe("deactivateAccount and restoreAccount", () => {
    it("деактивирует аккаунт, отзывает сессию и публикует в Redis", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      await service.deactivateAccount(mockUser.id, "session-123");

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          deletedAt: expect.any(Date),
          generation: { increment: 1 },
        },
        select: {
          generation: true,
        },
      });
      expect(prismaMock.authRevocationTask.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          generation: 1,
        },
      });
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        "auth:session:session-123",
      );
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUser.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledWith(
        "auth:revocations",
        expect.stringContaining(mockUser.id),
      );
    });

    it("не удаляет authRevocationTask если публикация в Redis завершилась ошибкой", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      redisServiceMock.publish = jest
        .fn()
        .mockRejectedValue(new Error("Redis publish error"));

      await service.deactivateAccount(mockUser.id, "session-123");

      expect(prismaMock.authRevocationTask.delete).not.toHaveBeenCalled();
    });

    it("восстанавливает аккаунт если прошло менее 30 дней", async () => {
      const recentlyDeletedUser = {
        ...mockUser,
        deletedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 дней назад
      };
      prismaMock.user.findUnique.mockResolvedValue(recentlyDeletedUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        deletedAt: null,
      });

      const result = await service.restoreAccount(mockUser.id);

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { deletedAt: null },
        select: expect.any(Object),
      });
      expect(result.id).toBe(mockUser.id);
      expect(result.email).toBe(mockUser.email);
      expect(result.role).toBe(SystemRole.USER);
      expect(result.permissions).toBe("2");
    });

    it("выбрасывает GoneException если прошло более 30 дней", async () => {
      const expiredDeletedUser = {
        ...mockUser,
        deletedAt: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 дней назад
      };
      prismaMock.user.findUnique.mockResolvedValue(expiredDeletedUser);

      await expect(service.restoreAccount(mockUser.id)).rejects.toThrow(
        GoneException,
      );
    });
  });

  describe("linkTelegram", () => {
    it("успешно привязывает Telegram аккаунт к пользователю", async () => {
      prismaMock.user.findUnique.mockImplementation(async (args) => {
        if (args.where.id) return { ...mockUser, telegramId: null };
        return null;
      });
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        telegramId: BigInt(123456789),
        telegramUsername: "new_tg",
      });

      const result = await service.linkTelegram(mockUser.id, {
        telegramId: BigInt(123456789),
        telegramUsername: "new_tg",
      });

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          telegramId: BigInt(123456789),
          telegramUsername: "new_tg",
          telegramLinkVerified: true,
        },
      });
      expect(result).toEqual({
        message: "Telegram account linked successfully",
      });
    });

    it("выбрасывает NotFoundException если пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.linkTelegram("non-existent", {
          telegramId: BigInt(123456789),
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it("выбрасывает ConflictException если пользователь уже имеет другой привязанный telegramId", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        telegramId: BigInt(999999999),
      });

      await expect(
        service.linkTelegram(mockUser.id, {
          telegramId: BigInt(123456789),
        }),
      ).rejects.toThrow("Telegram account is already linked to this user");
    });

    it("выбрасывает BadRequestException при попытке подтвердить уже привязанный неподтвержденный telegramId (telegramLinkVerified: false)", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        telegramId: BigInt(123456789),
        telegramLinkVerified: false,
      });

      await expect(
        service.linkTelegram(mockUser.id, {
          telegramId: BigInt(123456789),
        }),
      ).rejects.toThrow(
        new BadRequestException(
          "Cannot verify unconfirmed Telegram link without independent email verification",
        ),
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("выбрасывает ConflictException если тот же telegramId уже привязан и подтвержден", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        telegramId: BigInt(123456789),
        telegramLinkVerified: true,
      });

      await expect(
        service.linkTelegram(mockUser.id, {
          telegramId: BigInt(123456789),
        }),
      ).rejects.toThrow("Telegram account is already linked to this user");
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("выбрасывает ConflictException если telegramId уже привязан к другому пользователю", async () => {
      prismaMock.user.findUnique.mockImplementation(async (args) => {
        if (args.where.id) return { ...mockUser, telegramId: null };
        if (args.where.telegramId)
          return {
            id: "22222222-2222-4222-a222-222222222222",
            telegramId: BigInt(123456789),
          };
        return null;
      });

      await expect(
        service.linkTelegram(mockUser.id, {
          telegramId: BigInt(123456789),
        }),
      ).rejects.toThrow("Telegram account is already linked to another user");
    });

    it("обрабатывает Prisma P2025 ошибки как NotFoundException", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUser,
        telegramId: null,
      });
      const p2025 = Object.assign(new Error("Record not found"), {
        code: "P2025",
      });
      prismaMock.user.update.mockRejectedValue(p2025);

      await expect(
        service.linkTelegram(mockUser.id, {
          telegramId: BigInt(123456789),
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findByTelegramId and createTelegramUser", () => {
    it("ищет пользователя по telegramId", async () => {
      const tgUser = { ...mockUser, telegramId: BigInt(123456789) };
      prismaMock.user.findUnique.mockResolvedValue(tgUser);

      const result = await service.findByTelegramId(BigInt(123456789));

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: BigInt(123456789) },
      });
      expect(result).toEqual(tgUser);
    });

    it("создает нового пользователя через createTelegramUser", async () => {
      const createdUser = {
        ...mockUser,
        telegramId: BigInt(123456789),
        telegramUsername: "tg_user",
        username: null,
      };
      prismaMock.user.create.mockResolvedValue(createdUser);

      const result = await service.createTelegramUser({
        email: "tg@example.com",
        passwordHash: "argon2id$hash",
        telegramId: BigInt(123456789),
        telegramUsername: "tg_user",
        displayName: "Telegram User",
        avatarUrl: "https://s3.local/avatar.webp",
      });

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          email: "tg@example.com",
          passwordHash: "argon2id$hash",
          telegramId: BigInt(123456789),
          telegramUsername: "tg_user",
          telegramLinkVerified: false,
          displayName: "Telegram User",
          avatarUrl: "https://s3.local/avatar.webp",
          username: null,
          roleId: "00000000-0000-4000-a000-000000000002",
        },
      });
      expect(result).toEqual(createdUser);
    });
  });

  describe("getPublicProfile", () => {
    it("ищет по UUID и игнорирует удаленные аккаунты", async () => {
      const publicData = {
        id: mockUser.id,
        displayName: mockUser.displayName,
        username: mockUser.username,
        avatarUrl: mockUser.avatarUrl,
        telegramUsername: mockUser.telegramUsername,
        gitUrl: mockUser.gitUrl,
        createdAt: mockUser.createdAt,
      };
      prismaMock.user.findFirst.mockResolvedValue(publicData);

      const result = await service.getPublicProfile(mockUser.id);

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { id: mockUser.id, deletedAt: null },
        select: expect.any(Object),
      });
      expect(result).toEqual({
        ...publicData,
        createdAt: mockUser.createdAt.toISOString(),
      });
    });
  });

  describe("deviceSettings", () => {
    const validUserId = "11111111-1111-4111-a111-111111111111";
    const clientId = "client-device-1";

    it("getDeviceSettings возвращает настройки по умолчанию, если записи нет в базе", async () => {
      prismaMock.userDeviceSettings.findUnique.mockResolvedValue(null);

      const result = await service.getDeviceSettings(validUserId, clientId);

      expect(result).toEqual({
        clientId,
        deviceName: null,
        audioVolume: 80,
        speechVolume: 80,
        micGain: 100,
        preferredAudioInputLabel: null,
        preferredAudioOutputLabel: null,
        preferredVideoInputLabel: null,
        isPersisted: false,
      });
    });

    it("upsertDeviceSettings сериализует обновление через FOR UPDATE и удаляет лишние устройства при превышении лимита 10", async () => {
      const mockRecord = {
        id: "dev-new",
        userId: validUserId,
        clientId,
        deviceName: "Chrome MacBook",
        audioVolume: 75,
        speechVolume: 85,
        micGain: 90,
        preferredAudioInputLabel: "Built-in Mic",
        preferredAudioOutputLabel: "Built-in Speaker",
        preferredVideoInputLabel: "FaceTime HD",
        isPersisted: true,
      };

      prismaMock.userDeviceSettings.findUnique.mockResolvedValue(null);
      prismaMock.userDeviceSettings.upsert.mockResolvedValue(mockRecord);
      // Возвращаем 12 устройств для проверки очистки до 10
      const mockDevicesList = Array.from({ length: 12 }, (_, i) => ({
        id: `dev-${i}`,
      }));
      prismaMock.userDeviceSettings.findMany.mockResolvedValue(mockDevicesList);

      const result = await service.upsertDeviceSettings(validUserId, {
        clientId,
        deviceName: "Chrome MacBook",
        audioVolume: 75,
        speechVolume: 85,
        micGain: 90,
      });

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.$queryRaw).toHaveBeenCalled();
      expect(prismaMock.userDeviceSettings.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            userId_clientId: {
              userId: validUserId,
              clientId,
            },
          },
        }),
      );
      // Проверяем удаление самых старых устройств (dev-10, dev-11)
      expect(prismaMock.userDeviceSettings.deleteMany).toHaveBeenCalledWith({
        where: { id: { in: ["dev-10", "dev-11"] } },
      });
      expect(result.isPersisted).toBe(true);
      expect(result.audioVolume).toBe(75);
    });

    it("upsertDeviceSettings выбрасывает NotFoundException, если пользователь не найден при FOR UPDATE блокировке", async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await expect(
        service.upsertDeviceSettings(validUserId, { clientId }),
      ).rejects.toThrow(NotFoundException);
    });

    it("upsertDeviceSettings выбрасывает BadRequestException при невалидном userId", async () => {
      await expect(
        service.upsertDeviceSettings("not-a-uuid", { clientId }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("requestTelegramUnlink", () => {
    const LINKED_USER = {
      id: "11111111-1111-4111-a111-111111111111",
      telegramChatId: "987654321",
      telegramLinkVerified: true,
      locale: "ru",
      telegramLocale: null,
      timezone: "Europe/Moscow",
    };

    it("кладёт только SHA-256 хеш кода в Redis, публикует envelope боту и возвращает expiresAt (D6, D14)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(LINKED_USER);

      const result = await service.requestTelegramUnlink(mockUser.id);

      expect(result.sent).toBe(true);
      expect(result.expiresAt).toEqual(expect.any(String));

      // 1) В Redis уходит хеш, а не сам код; TTL = 10 минут.
      expect(redisServiceMock.set).toHaveBeenCalledTimes(1);
      const [setKey, setValue, setTtl] = redisServiceMock.set.mock.calls[0];
      expect(setKey).toBe(`telegram:unlink:${mockUser.id}`);
      expect(setTtl).toBe(600);
      expect(setValue).toContain('"hash":"');
      expect(setValue).toContain('"attempts":0');

      // 2) Код уходит боту тем же envelope'ом, что и push-уведомления.
      expect(rabbitMqPublisherMock.publish).toHaveBeenCalledTimes(1);
      const [envelope, routingKey] =
        rabbitMqPublisherMock.publish.mock.calls[0];
      expect(envelope.event.type).toBe("security.telegram_unlink_code");
      expect(envelope.event.payload.code).toMatch(/^\d{6}$/);
      expect(envelope.event.payload.ttlMinutes).toBe(10);
      expect(envelope.chatId).toBe(LINKED_USER.telegramChatId);
      expect(envelope.locale).toBe("ru");
      expect(envelope.timeZone).toBe("Europe/Moscow");
      expect(routingKey).toContain(`security:tg-unlink:${mockUser.id}`);

      // 3) Записан в Redis именно хеш отправленного кода.
      expect(setValue).toContain(
        createHash("sha256")
          .update(envelope.event.payload.code as string)
          .digest("hex"),
      );

      // 4) Сам код не попадает в хранилище (D14).
      expect(setValue).not.toContain(envelope.event.payload.code as string);
    });

    it("400 TELEGRAM_NOT_LINKED, если Telegram не привязан", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...LINKED_USER,
        telegramChatId: null,
        telegramLinkVerified: false,
      });

      await expectErrorCode(
        service.requestTelegramUnlink(mockUser.id),
        HttpStatus.BAD_REQUEST,
        SECURITY_UNLINK_ERROR_CODES.TELEGRAM_NOT_LINKED,
      );
      expect(rabbitMqPublisherMock.publish).not.toHaveBeenCalled();
      expect(redisServiceMock.set).not.toHaveBeenCalled();
    });

    it("404, если пользователя нет", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.requestTelegramUnlink(mockUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });

    it("503 при недоступности брокера + запись кода удаляется (код не «висит» без получателя)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(LINKED_USER);
      rabbitMqPublisherMock.publish.mockRejectedValueOnce(
        new Error("broker down"),
      );

      await expect(service.requestTelegramUnlink(mockUser.id)).rejects.toThrow(
        ServiceUnavailableException,
      );

      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        `telegram:unlink:${mockUser.id}`,
      );
    });
  });

  describe("confirmTelegramUnlink", () => {
    const CODE = "123456";
    const KEY = `telegram:unlink:${mockUser.id}`;
    const codeHash = createHash("sha256").update(CODE).digest("hex");

    function seedValidRecord(overrides: Record<string, unknown> = {}) {
      redisServiceMock.get.mockResolvedValue(
        JSON.stringify({
          hash: codeHash,
          attempts: 0,
          expiresAt: Date.now() + 600_000,
          ...overrides,
        }),
      );
    }

    function seedLinkedUser() {
      prismaMock.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        telegramChatId: "987654321",
        telegramLinkVerified: true,
      });
    }

    it("успех: сравнение хеша, атомарный расход записи, инкремент generation, аудит и ревокация", async () => {
      seedValidRecord();
      redisServiceMock.compareAndDelete.mockResolvedValue(true);
      seedLinkedUser();
      prismaMock.user.update.mockResolvedValue({ generation: 2 });

      const result = await service.confirmTelegramUnlink(
        mockUser.id,
        CODE,
        "203.0.113.7",
        "Mozilla/5.0",
      );

      expect(result).toEqual({ success: true });

      // Запись расходуется compare-and-delete только после успешной проверки.
      expect(redisServiceMock.compareAndDelete).toHaveBeenCalledWith(
        KEY,
        expect.any(String),
      );
      // Неверные попытки не инкрементируются при успехе.
      expect(redisServiceMock.eval).not.toHaveBeenCalled();

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          telegramId: null,
          telegramUsername: null,
          telegramChatId: null,
          telegramLinkVerified: false,
          telegramLocale: null,
          generation: { increment: 1 },
        },
        select: { generation: true },
      });
      expect(prismaMock.authRevocationTask.create).toHaveBeenCalledWith({
        data: { userId: mockUser.id, generation: 1 },
      });
      expect(securityEventsServiceMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          type: "TG_UNLINKED",
          ipAddress: "203.0.113.7",
          userAgent: "Mozilla/5.0",
          metadata: { channel: "web" },
        }),
      );
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Date),
        1,
      );
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("400 INVALID_CODE при неверном коде + инкремент попыток через Lua", async () => {
      seedValidRecord();
      redisServiceMock.eval.mockResolvedValue(0);

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, "000000"),
        HttpStatus.BAD_REQUEST,
        SECURITY_UNLINK_ERROR_CODES.INVALID_CODE,
      );

      expect(redisServiceMock.eval).toHaveBeenCalledTimes(1);
      expect(redisServiceMock.compareAndDelete).not.toHaveBeenCalled();
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("429 ATTEMPTS_EXCEEDED, когда Lua-скрипт вернул «лимит исчерпан»", async () => {
      seedValidRecord();
      redisServiceMock.eval.mockResolvedValue(-2);

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, "000000"),
        HttpStatus.TOO_MANY_REQUESTS,
        SECURITY_UNLINK_ERROR_CODES.ATTEMPTS_EXCEEDED,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("410 CODE_EXPIRED, когда запись пропала между чтением и инкрементом (Lua → -1)", async () => {
      seedValidRecord();
      redisServiceMock.eval.mockResolvedValue(-1);

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, "000000"),
        HttpStatus.GONE,
        SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
      );
    });

    it("410 CODE_EXPIRED, если записи кода нет (срок истёк и удалена)", async () => {
      redisServiceMock.get.mockResolvedValue(null);

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, CODE),
        HttpStatus.GONE,
        SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
      );
    });

    it("410 CODE_EXPIRED, если expiresAt в прошлом + запись удаляется", async () => {
      redisServiceMock.get.mockResolvedValue(
        JSON.stringify({ hash: codeHash, attempts: 0, expiresAt: 1 }),
      );

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, CODE),
        HttpStatus.GONE,
        SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
      );
      expect(redisServiceMock.delete).toHaveBeenCalledWith(KEY);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("410 CODE_EXPIRED на повреждённой записи (не парсится / нет хеша)", async () => {
      redisServiceMock.get.mockResolvedValue("not-json");

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, CODE),
        HttpStatus.GONE,
        SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED,
      );
    });

    it("409 ALREADY_UNLINKED, когда параллельный confirm уже израсходовал код", async () => {
      seedValidRecord();
      redisServiceMock.compareAndDelete.mockResolvedValue(false);

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, CODE),
        HttpStatus.CONFLICT,
        SECURITY_UNLINK_ERROR_CODES.ALREADY_UNLINKED,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("409 ALREADY_UNLINKED, когда запись жива, но Telegram уже отвязан", async () => {
      seedValidRecord();
      redisServiceMock.compareAndDelete.mockResolvedValue(true);
      prismaMock.user.findUnique.mockResolvedValue({
        id: mockUser.id,
        telegramChatId: null,
        telegramLinkVerified: false,
      });

      await expectErrorCode(
        service.confirmTelegramUnlink(mockUser.id, CODE),
        HttpStatus.CONFLICT,
        SECURITY_UNLINK_ERROR_CODES.ALREADY_UNLINKED,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("500, если Redis недоступен на чтении (отвязка не падает затаённо)", async () => {
      redisServiceMock.get.mockRejectedValue(new Error("redis down"));

      await expect(
        service.confirmTelegramUnlink(mockUser.id, CODE),
      ).rejects.toThrow(InternalServerErrorException);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });

  describe("unlinkGithub", () => {
    function seedUser(user: Record<string, unknown> | null) {
      prismaMock.user.findUnique.mockResolvedValue(user);
    }

    it("успех: снимает githubId/gitUrl, инкрементирует generation, пишет аудит и отзывает сессии", async () => {
      seedUser({
        id: mockUser.id,
        githubId: "gh-123456",
        passwordHash: "argon2id$hashed",
        telegramChatId: null,
        telegramLinkVerified: false,
      });
      prismaMock.user.update.mockResolvedValue({ generation: 3 });

      const result = await service.unlinkGithub(
        mockUser.id,
        "203.0.113.7",
        "Mozilla/5.0",
      );

      expect(result).toEqual({ success: true });
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: {
          githubId: null,
          gitUrl: null,
          generation: { increment: 1 },
        },
        select: { generation: true },
      });
      expect(prismaMock.authRevocationTask.create).toHaveBeenCalledWith({
        data: { userId: mockUser.id, generation: 2 },
      });
      expect(securityEventsServiceMock.record).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "GITHUB_UNLINKED",
          ipAddress: "203.0.113.7",
        }),
      );
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUser.id,
        expect.any(Date),
        2,
      );
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("400 GITHUB_NOT_LINKED, если GitHub не привязан", async () => {
      seedUser({
        id: mockUser.id,
        githubId: null,
        passwordHash: "argon2id$hashed",
        telegramChatId: null,
        telegramLinkVerified: false,
      });

      await expectErrorCode(
        service.unlinkGithub(mockUser.id),
        HttpStatus.BAD_REQUEST,
        SECURITY_UNLINK_ERROR_CODES.GITHUB_NOT_LINKED,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("409 LAST_AUTH_METHOD, когда GitHub — единственный способ входа", async () => {
      seedUser({
        id: mockUser.id,
        githubId: "gh-123456",
        passwordHash: null,
        telegramChatId: null,
        telegramLinkVerified: false,
      });

      await expectErrorCode(
        service.unlinkGithub(mockUser.id),
        HttpStatus.CONFLICT,
        SECURITY_UNLINK_ERROR_CODES.LAST_AUTH_METHOD,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
      expect(securityEventsServiceMock.record).not.toHaveBeenCalled();
    });

    it("отвязка разрешена, если есть подтверждённый Telegram, даже без пароля", async () => {
      seedUser({
        id: mockUser.id,
        githubId: "gh-123456",
        passwordHash: null,
        telegramChatId: "987654321",
        telegramLinkVerified: true,
      });
      prismaMock.user.update.mockResolvedValue({ generation: 2 });

      await expect(service.unlinkGithub(mockUser.id)).resolves.toEqual({
        success: true,
      });
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it("404, если пользователя нет", async () => {
      seedUser(null);

      await expect(service.unlinkGithub(mockUser.id)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
