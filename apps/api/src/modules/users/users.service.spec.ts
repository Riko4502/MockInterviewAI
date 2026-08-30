import {
  ConflictException,
  GoneException,
  NotFoundException,
} from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import type { StorageService } from "../storage/storage.service";
import { UsersService } from "./users.service";

describe("UsersService", () => {
  let prismaMock: {
    user: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };
  let storageServiceMock: jest.Mocked<Partial<StorageService>>;
  let redisServiceMock: jest.Mocked<Partial<RedisService>>;
  let service: UsersService;

  const mockUser = {
    id: "11111111-1111-4111-a111-111111111111",
    email: "test@example.com",
    passwordHash: "argon2id$hashed",
    displayName: "Ivan Ivanov",
    username: "ivan_dev",
    avatarUrl: "https://example.com/avatar.webp",
    telegramUsername: "ivan_tg",
    gitUrl: "https://github.com/ivan_dev",
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    storageServiceMock = {
      uploadAvatar: jest
        .fn()
        .mockResolvedValue("https://s3.example.com/new_avatar.webp"),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    redisServiceMock = {
      delete: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
    };

    service = new UsersService(
      prismaMock as unknown as PrismaService,
      storageServiceMock as StorageService,
      redisServiceMock as RedisService,
    );
  });

  describe("getProfile", () => {
    it("возвращает профиль пользователя без passwordHash", async () => {
      const { passwordHash: _, ...safeProfile } = mockUser;
      prismaMock.user.findUnique.mockResolvedValue(safeProfile);

      const result = await service.getProfile(mockUser.id);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        select: expect.any(Object),
      });
      expect(result).toEqual(safeProfile);
      expect(result).not.toHaveProperty("passwordHash");
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
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      const updatedProfile = {
        ...mockUser,
        displayName: "New Name",
        telegramUsername: "new_tg",
        gitUrl: "https://gitlab.com/new_user",
      };
      prismaMock.user.update.mockResolvedValue(updatedProfile);

      const result = await service.updateProfile(mockUser.id, {
        displayName: "New Name",
        telegramUsername: "new_tg",
        gitUrl: "https://gitlab.com/new_user",
      });

      expect(result.displayName).toBe("New Name");
      expect(result.gitUrl).toBe("https://gitlab.com/new_user");
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it("выбрасывает ConflictException при попытке занять чужой username", async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(mockUser)
        .mockResolvedValueOnce({
          id: "22222222-2222-4222-a222-222222222222",
          username: "taken_username",
        });

      await expect(
        service.updateProfile(mockUser.id, { username: "taken_username" }),
      ).rejects.toThrow(ConflictException);
    });

    it("выбрасывает NotFoundException если обновляемый пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateProfile("non-existent", { displayName: "Test" }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateAvatar and deleteAvatar", () => {
    it("загружает новый аватар, сохраняет в БД и удаляет старый", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.user.update.mockResolvedValue({
        ...mockUser,
        avatarUrl: "https://s3.example.com/new_avatar.webp",
      });

      const mockFile = { buffer: Buffer.from("test") } as Express.Multer.File;
      const result = await service.updateAvatar(mockUser.id, mockFile);

      expect(storageServiceMock.uploadAvatar).toHaveBeenCalledWith(
        mockUser.id,
        mockFile,
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        mockUser.avatarUrl,
      );
      expect(result).toEqual({
        avatarUrl: "https://s3.example.com/new_avatar.webp",
      });
    });

    it("удаляет текущий аватар из S3 и обнуляет в БД", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

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
        data: { deletedAt: expect.any(Date) },
      });
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        "auth:session:session-123",
      );
      expect(redisServiceMock.publish).toHaveBeenCalledWith(
        "auth:revocations",
        expect.stringContaining(mockUser.id),
      );
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
      expect(result.deletedAt).toBeNull();
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
      expect(result).toEqual(publicData);
    });
  });
});
