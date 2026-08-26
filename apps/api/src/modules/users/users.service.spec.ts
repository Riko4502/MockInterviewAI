import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
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
    service = new UsersService(prismaMock as unknown as PrismaService);
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
        .mockResolvedValueOnce(mockUser) // findById(userId)
        .mockResolvedValueOnce({
          id: "22222222-2222-4222-a222-222222222222",
          username: "taken_username",
        }); // findByUsername

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

  describe("getPublicProfile", () => {
    it("ищет по UUID если передан валидный UUID", async () => {
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
        where: { id: mockUser.id },
        select: expect.any(Object),
      });
      expect(result).toEqual(publicData);
      expect(result).not.toHaveProperty("email");
    });

    it("ищет по username если передан никнейм", async () => {
      const publicData = {
        id: mockUser.id,
        displayName: mockUser.displayName,
        username: "ivan_dev",
        avatarUrl: mockUser.avatarUrl,
        telegramUsername: mockUser.telegramUsername,
        gitUrl: mockUser.gitUrl,
        createdAt: mockUser.createdAt,
      };
      prismaMock.user.findFirst.mockResolvedValue(publicData);

      const result = await service.getPublicProfile("ivan_dev");

      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: { username: "ivan_dev" },
        select: expect.any(Object),
      });
      expect(result.username).toBe("ivan_dev");
    });

    it("выбрасывает NotFoundException если пользователь не найден", async () => {
      prismaMock.user.findFirst.mockResolvedValue(null);

      await expect(service.getPublicProfile("unknown_user")).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
