import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type {
  AdminUsersQueryDto,
  CreateUserAdminDto,
  UpdateUserAdminDto,
  UserStatusAdminDto,
} from "@packages/dto";
import { SystemPermission } from "@packages/types";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { RedisService } from "../../../redis/redis.service";
import type { AuthSessionService } from "../../auth/services/auth-session.service";
import type { StorageService } from "../../storage/storage.service";
import { AdminUsersService } from "./admin-users.service";

jest.mock("argon2", () => ({
  hash: jest.fn().mockResolvedValue("mocked_argon2_hash"),
  argon2id: 2,
}));

describe("AdminUsersService", () => {
  let service: AdminUsersService;
  let prismaMock: {
    user: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      count: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    role: {
      findUnique: jest.Mock;
    };
    authRevocationTask: {
      create: jest.Mock;
      delete: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let configServiceMock: {
    get: jest.Mock;
  };
  let authSessionServiceMock: {
    revokeAllUserSessions: jest.Mock;
  };
  let redisServiceMock: {
    publish: jest.Mock;
  };
  let storageServiceMock: {
    deleteFile: jest.Mock;
  };

  const mockUserRecord = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "test@example.com",
    username: "testuser",
    displayName: "Test User",
    isActive: true,
    deactivatedAt: null,
    deletedAt: null,
    avatarUrl: "https://storage.example.com/avatar.png",
    telegramUsername: "test_tg",
    roleId: "00000000-0000-4000-a000-000000000002",
    gitUrl: "https://github.com/testuser",
    generation: 1,
    createdAt: new Date("2026-09-01T00:00:00.000Z"),
    updatedAt: new Date("2026-09-10T00:00:00.000Z"),
    role: {
      id: "00000000-0000-4000-a000-000000000002",
      slug: "USER",
      name: "Пользователь",
      permissions: SystemPermission.NONE,
    },
  };

  beforeEach(() => {
    prismaMock = {
      user: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      role: {
        findUnique: jest.fn(),
      },
      authRevocationTask: {
        create: jest.fn().mockResolvedValue({
          id: "task-1",
          createdAt: new Date("2026-09-10T12:00:00.000Z"),
        }),
        delete: jest.fn().mockResolvedValue({ id: "task-1" }),
      },
      $transaction: jest.fn().mockImplementation((arg) => {
        if (typeof arg === "function") {
          return arg(prismaMock);
        }
        return Promise.all(arg);
      }),
    };

    configServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        const config: Record<string, unknown> = {
          "argon2.memoryCost": 65536,
          "argon2.timeCost": 3,
          "argon2.parallelism": 4,
        };
        return config[key];
      }),
    };

    authSessionServiceMock = {
      revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
    };

    redisServiceMock = {
      publish: jest.fn().mockResolvedValue(1),
    };

    storageServiceMock = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };

    service = new AdminUsersService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
      authSessionServiceMock as unknown as AuthSessionService,
      redisServiceMock as unknown as RedisService,
      storageServiceMock as unknown as StorageService,
    );
  });

  describe("getUsersList", () => {
    it("возвращает пагинированный список пользователей и рассчитывает метаданные", async () => {
      prismaMock.$transaction.mockResolvedValue([[mockUserRecord], 1]);

      const query: AdminUsersQueryDto = {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "desc",
      };

      const result = await service.getUsersList(query);

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toEqual({
        id: mockUserRecord.id,
        email: mockUserRecord.email,
        username: mockUserRecord.username,
        displayName: mockUserRecord.displayName,
        role: "USER",
        isActive: true,
        deactivatedAt: null,
        deletedAt: null,
        avatarUrl: mockUserRecord.avatarUrl,
        telegramUsername: mockUserRecord.telegramUsername,
        gitUrl: mockUserRecord.gitUrl,
        createdAt: mockUserRecord.createdAt.toISOString(),
        updatedAt: mockUserRecord.updatedAt.toISOString(),
      });
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      });
    });

    it("применяет фильтрацию по поиску, роли и активности", async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      const query: AdminUsersQueryDto = {
        page: 2,
        limit: 10,
        search: "alex",
        role: "ADMIN",
        isActive: false,
        sortBy: "role",
        sortOrder: "asc",
      };

      const result = await service.getUsersList(query);

      expect(result.meta.page).toBe(2);
      expect(result.meta.limit).toBe(10);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { email: { contains: "alex", mode: "insensitive" } },
              { username: { contains: "alex", mode: "insensitive" } },
              { displayName: { contains: "alex", mode: "insensitive" } },
            ],
            role: { slug: "ADMIN" },
            isActive: false,
          },
          orderBy: { role: { slug: "asc" } },
          skip: 10,
          take: 10,
        }),
      );
    });

    it("применяет фильтрацию по isDeleted (true -> not: null, false -> null)", async () => {
      prismaMock.$transaction.mockResolvedValue([[], 0]);

      await service.getUsersList({ isDeleted: true });
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: { not: null },
          },
        }),
      );

      await service.getUsersList({ isDeleted: false });
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            deletedAt: null,
          },
        }),
      );
    });
  });

  describe("getUserById", () => {
    it("возвращает пользователя со статистикой сессий", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUserRecord,
        _count: {
          sessions: 5,
          participations: 12,
        },
      });

      const result = await service.getUserById(mockUserRecord.id);

      expect(result.id).toBe(mockUserRecord.id);
      expect(result.sessionsCount).toBe(5);
      expect(result.participationsCount).toBe(12);
      expect(result.role).toBe("USER");
    });

    it("выбрасывает NotFoundException если пользователь не существует", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserById("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("createUser", () => {
    const createDto: CreateUserAdminDto = {
      email: "newuser@example.com",
      role: "USER",
      username: "newuser",
      displayName: "New User",
      isActive: true,
    };

    it("успешно создает пользователя и не возвращает пароль", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-user-id",
        slug: "USER",
      });
      prismaMock.user.create.mockResolvedValue({
        ...mockUserRecord,
        email: createDto.email,
        username: createDto.username,
      });

      const result = await service.createUser(createDto);

      expect(result.email).toBe(createDto.email);
      expect(result).not.toHaveProperty("password");
      expect(result).not.toHaveProperty("passwordHash");
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    });

    it("выбрасывает ConflictException при дубликате email", async () => {
      prismaMock.user.findUnique.mockResolvedValueOnce(mockUserRecord);

      await expect(service.createUser(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("выбрасывает ConflictException при дубликате username", async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce(mockUserRecord); // username check

      await expect(service.createUser(createDto)).rejects.toThrow(
        ConflictException,
      );
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });

    it("выбрасывает BadRequestException если указанная роль не найдена", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.role.findUnique.mockResolvedValue(null);

      await expect(
        service.createUser({ ...createDto, role: "NON_EXISTENT_ROLE" }),
      ).rejects.toThrow(BadRequestException);
    });

    it("выбрасывает ConflictException при P2002 (race condition при создании пользователя)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-user-id",
        slug: "USER",
      });
      const p2002Error = new Error("Unique constraint failed");
      Object.assign(p2002Error, { code: "P2002", meta: { target: ["email"] } });
      prismaMock.user.create.mockRejectedValue(p2002Error);

      await expect(service.createUser(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("updateUser", () => {
    const updateDto: UpdateUserAdminDto = {
      displayName: "Updated Name",
      role: "ADMIN",
    };

    it("успешно обновляет поля и отзывает сессии при смене роли", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-admin-id",
        slug: "ADMIN",
      });
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        generation: 2,
        displayName: "Updated Name",
        role: { slug: "ADMIN", permissions: 1n },
      });

      const result = await service.updateUser(mockUserRecord.id, updateDto);

      expect(result.displayName).toBe("Updated Name");
      expect(result.role).toBe("ADMIN");
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("не удаляет authRevocationTask если публикация в Redis завершилась ошибкой", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-admin-id",
        slug: "ADMIN",
      });
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        generation: 2,
        displayName: "Updated Name",
        role: { slug: "ADMIN", permissions: 1n },
      });
      redisServiceMock.publish.mockRejectedValue(
        new Error("Redis publish error"),
      );

      const result = await service.updateUser(mockUserRecord.id, updateDto);

      expect(result.role).toBe("ADMIN");
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(prismaMock.authRevocationTask.delete).not.toHaveBeenCalled();
    });

    it("отзывает сессии при смене email", async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(mockUserRecord) // existing
        .mockResolvedValueOnce(null); // email conflict check
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        email: "newemail@example.com",
        generation: 2,
      });

      const result = await service.updateUser(mockUserRecord.id, {
        email: "newemail@example.com",
      });

      expect(result.email).toBe("newemail@example.com");
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
    });

    it("отзывает сессии при смене username", async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(mockUserRecord) // existing
        .mockResolvedValueOnce(null); // username conflict check
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        username: "newusername",
        generation: 2,
      });

      const result = await service.updateUser(mockUserRecord.id, {
        username: "newusername",
      });

      expect(result.username).toBe("newusername");
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
    });

    it("отзывает сессии при сбросе username в null (Task 13)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord); // existing
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        username: null,
        generation: 2,
      });

      const result = await service.updateUser(mockUserRecord.id, {
        username: null,
      });

      expect(result.username).toBeNull();
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
    });

    it("удаляет старый аватар из S3 при смене аватара", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        avatarUrl: "https://storage.example.com/new-avatar.png",
      });

      await service.updateUser(mockUserRecord.id, {
        avatarUrl: "https://storage.example.com/new-avatar.png",
      });

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        mockUserRecord.avatarUrl,
      );
    });

    it("удаляет старый аватар из S3 при обнулении avatarUrl", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        avatarUrl: null,
      });

      await service.updateUser(mockUserRecord.id, {
        avatarUrl: null,
      });

      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        mockUserRecord.avatarUrl,
      );
    });

    it("не отзывает сессии если роль, email и username не менялись", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.role.findUnique.mockResolvedValue({
        id: "00000000-0000-4000-a000-000000000002",
        slug: "USER",
      });
      prismaMock.user.update.mockResolvedValue(mockUserRecord);

      await service.updateUser(mockUserRecord.id, {
        displayName: "New Display Name",
        role: "USER",
      });

      expect(
        authSessionServiceMock.revokeAllUserSessions,
      ).not.toHaveBeenCalled();
    });

    it("выбрасывает BadRequestException при попытке изменить роль собственного аккаунта администратора", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.role.findUnique.mockResolvedValue({
        id: "role-admin-id",
        slug: "ADMIN",
      });

      await expect(
        service.updateUser(
          mockUserRecord.id,
          { role: "ADMIN" },
          mockUserRecord.id,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it("выбрасывает ConflictException при конфликте username", async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(mockUserRecord) // target user exists
        .mockResolvedValueOnce({
          id: "other-user-id",
          username: "taken_username",
        }); // collision check

      await expect(
        service.updateUser(mockUserRecord.id, { username: "taken_username" }),
      ).rejects.toThrow(ConflictException);
    });

    it("выбрасывает ConflictException при P2002 (race condition при обновлении пользователя)", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      const p2002Error = new Error("Unique constraint failed");
      Object.assign(p2002Error, {
        code: "P2002",
        meta: { target: ["username"] },
      });
      prismaMock.user.update.mockRejectedValue(p2002Error);

      await expect(
        service.updateUser(mockUserRecord.id, { username: "taken_username" }),
      ).rejects.toThrow(ConflictException);
    });

    it("выбрасывает NotFoundException если пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.updateUser("non-existent-id", updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("updateStatus", () => {
    it("защищает от деактивации собственного аккаунта администратора", async () => {
      const adminId = "admin-uuid-123";
      const dto: UserStatusAdminDto = { isActive: false };

      await expect(service.updateStatus(adminId, dto, adminId)).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });

    it("деактивирует пользователя, проставляет deactivatedAt и отзывает сессии", async () => {
      const adminId = "admin-uuid-123";
      const targetUserId = "user-uuid-456";
      const dto: UserStatusAdminDto = { isActive: false };

      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        generation: 2,
        isActive: false,
        deactivatedAt: new Date(),
      });

      const result = await service.updateStatus(targetUserId, dto, adminId);

      expect(result.isActive).toBe(false);
      expect(result.deactivatedAt).not.toBeNull();
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        targetUserId,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("не удаляет authRevocationTask при деактивации, если публикация в Redis завершилась ошибкой", async () => {
      const adminId = "admin-uuid-123";
      const targetUserId = "user-uuid-456";
      const dto: UserStatusAdminDto = { isActive: false };

      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        generation: 2,
        isActive: false,
        deactivatedAt: new Date(),
      });
      redisServiceMock.publish.mockRejectedValue(
        new Error("Redis publish error"),
      );

      const result = await service.updateStatus(targetUserId, dto, adminId);

      expect(result.isActive).toBe(false);
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        targetUserId,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(prismaMock.authRevocationTask.delete).not.toHaveBeenCalled();
    });

    it("активирует пользователя, сбрасывает deactivatedAt и не отзывает сессии", async () => {
      const adminId = "admin-uuid-123";
      const targetUserId = "user-uuid-456";
      const dto: UserStatusAdminDto = { isActive: true };

      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        isActive: true,
        deactivatedAt: null,
      });

      const result = await service.updateStatus(targetUserId, dto, adminId);

      expect(result.isActive).toBe(true);
      expect(result.deactivatedAt).toBeNull();
      expect(
        authSessionServiceMock.revokeAllUserSessions,
      ).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    it("успешно сбрасывает пароль, инкрементирует generation и отзывает сессии", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        generation: 2,
      });

      const result = await service.resetPassword(mockUserRecord.id);

      expect(result.id).toBe(mockUserRecord.id);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockUserRecord.id },
          data: expect.objectContaining({
            passwordHash: expect.any(String),
            generation: { increment: 1 },
          }),
        }),
      );
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("выбрасывает NotFoundException если пользователь не существует", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.resetPassword("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("не удаляет authRevocationTask если публикация в Redis завершилась ошибкой", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        generation: 2,
      });
      redisServiceMock.publish.mockRejectedValue(
        new Error("Redis publish error"),
      );

      const result = await service.resetPassword(mockUserRecord.id);

      expect(result.id).toBe(mockUserRecord.id);
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(prismaMock.authRevocationTask.delete).not.toHaveBeenCalled();
    });
  });

  describe("deleteUser", () => {
    it("защищает от удаления собственного аккаунта администратора", async () => {
      await expect(
        service.deleteUser("admin-id-1", "admin-id-1"),
      ).rejects.toThrow(BadRequestException);
    });

    it("выбрасывает NotFoundException если пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteUser("non-existent-id", "current-admin-id"),
      ).rejects.toThrow(NotFoundException);
    });

    it("удаляет пользователя, проставляет deletedAt, isActive: false и отзывает сессии", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        deletedAt: new Date("2026-09-17T12:00:00.000Z"),
        isActive: false,
        generation: 2,
      });

      const result = await service.deleteUser(
        mockUserRecord.id,
        "other-admin-id",
      );

      expect(result.deletedAt).toBe("2026-09-17T12:00:00.000Z");
      expect(result.isActive).toBe(false);
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
        new Date("2026-09-10T12:00:00.000Z"),
        1,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
    });

    it("не удаляет authRevocationTask при удалении, если публикация в Redis завершилась ошибкой", async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUserRecord);
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        deletedAt: new Date(),
        isActive: false,
        generation: 2,
      });
      redisServiceMock.publish.mockRejectedValue(
        new Error("Redis publish error"),
      );

      const result = await service.deleteUser(
        mockUserRecord.id,
        "other-admin-id",
      );

      expect(result.id).toBe(mockUserRecord.id);
      expect(prismaMock.authRevocationTask.delete).not.toHaveBeenCalled();
    });
  });

  describe("restoreUser", () => {
    it("выбрасывает NotFoundException если пользователь не найден", async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.restoreUser("non-existent-id")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("выбрасывает BadRequestException если аккаунт пользователя не был удален", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUserRecord,
        deletedAt: null,
      });

      await expect(service.restoreUser(mockUserRecord.id)).rejects.toThrow(
        BadRequestException,
      );
    });

    it("успешно восстанавливает удаленного пользователя и активирует его", async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockUserRecord,
        deletedAt: new Date("2026-09-15T10:00:00.000Z"),
        isActive: false,
      });
      prismaMock.user.update.mockResolvedValue({
        ...mockUserRecord,
        deletedAt: null,
        isActive: true,
      });

      const result = await service.restoreUser(mockUserRecord.id);

      expect(result.deletedAt).toBeNull();
      expect(result.isActive).toBe(true);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUserRecord.id },
        data: {
          deletedAt: null,
          isActive: true,
          deactivatedAt: null,
        },
        select: expect.any(Object),
      });
    });
  });
});
