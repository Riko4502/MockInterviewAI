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

  const mockUserRecord = {
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "test@example.com",
    username: "testuser",
    displayName: "Test User",
    isActive: true,
    deactivatedAt: null,
    avatarUrl: "https://storage.example.com/avatar.png",
    telegramUsername: "test_tg",
    roleId: "00000000-0000-4000-a000-000000000002",
    gitUrl: "https://github.com/testuser",
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
        create: jest.fn().mockResolvedValue({ id: "task-1" }),
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

    service = new AdminUsersService(
      prismaMock as unknown as PrismaService,
      configServiceMock as unknown as ConfigService,
      authSessionServiceMock as unknown as AuthSessionService,
      redisServiceMock as unknown as RedisService,
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
        avatarUrl: mockUserRecord.avatarUrl,
        telegramUsername: mockUserRecord.telegramUsername,
        gitUrl: mockUserRecord.gitUrl,
        createdAt: mockUserRecord.createdAt,
        updatedAt: mockUserRecord.updatedAt,
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
      password: "StrongPassword123!",
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
        displayName: "Updated Name",
        role: { slug: "ADMIN", permissions: 1n },
      });

      const result = await service.updateUser(mockUserRecord.id, updateDto);

      expect(result.displayName).toBe("Updated Name");
      expect(result.role).toBe("ADMIN");
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        mockUserRecord.id,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
    });

    it("не отзывает сессии если роль не менялась", async () => {
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
        isActive: false,
        deactivatedAt: new Date(),
      });

      const result = await service.updateStatus(targetUserId, dto, adminId);

      expect(result.isActive).toBe(false);
      expect(result.deactivatedAt).not.toBeNull();
      expect(authSessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        targetUserId,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledTimes(1);
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
});
