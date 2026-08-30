import { Logger } from "@nestjs/common";
import type { PrismaService } from "../../../prisma/prisma.service";
import type { RedisService } from "../../../redis/redis.service";
import type { StorageService } from "../../storage/storage.service";
import { UserCleanupCron } from "./user-cleanup.cron";

describe("UserCleanupCron", () => {
  let cron: UserCleanupCron;
  let prismaMock: {
    user: {
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let storageServiceMock: {
    deleteFile: jest.Mock;
  };
  let redisServiceMock: {
    setNx: jest.Mock;
    delete: jest.Mock;
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "debug").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    prismaMock = {
      user: {
        findMany: jest.fn(),
        delete: jest.fn().mockResolvedValue({}),
      },
    };
    storageServiceMock = {
      deleteFile: jest.fn().mockResolvedValue(undefined),
    };
    redisServiceMock = {
      setNx: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    cron = new UserCleanupCron(
      prismaMock as unknown as PrismaService,
      storageServiceMock as unknown as StorageService,
      redisServiceMock as unknown as RedisService,
    );
  });

  describe("handleCron", () => {
    it("успешно захватывает lock, удаляет просроченные аккаунты и освобождает lock", async () => {
      const expiredUsers = [
        {
          id: "user-1",
          avatarUrl: "https://s3.example.com/avatars/user-1/a.webp",
        },
        {
          id: "user-2",
          avatarUrl: null,
        },
      ];

      // Первый вызов findMany возвращает 2 пользователей, второй - пустой массив (конец цикла)
      prismaMock.user.findMany
        .mockResolvedValueOnce(expiredUsers)
        .mockResolvedValueOnce([]);

      const result = await cron.handleCron();

      expect(redisServiceMock.setNx).toHaveBeenCalledWith(
        "lock:cron:user-cleanup",
        expect.any(String),
        3600,
      );
      expect(storageServiceMock.deleteFile).toHaveBeenCalledWith(
        "https://s3.example.com/avatars/user-1/a.webp",
      );
      expect(prismaMock.user.delete).toHaveBeenCalledTimes(2);
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        "lock:cron:user-cleanup",
      );
      expect(result).toBe(2);
    });

    it("пропускает выполнение если другая реплика уже держит lock", async () => {
      redisServiceMock.setNx.mockResolvedValue(false);

      const result = await cron.handleCron();

      expect(result).toBe(0);
      expect(prismaMock.user.findMany).not.toHaveBeenCalled();
      expect(redisServiceMock.delete).not.toHaveBeenCalled();
    });

    it("продолжает очистку остальных пользователей если один завершился с ошибкой", async () => {
      const expiredUsers = [
        { id: "user-1", avatarUrl: null },
        { id: "user-2", avatarUrl: null },
      ];

      prismaMock.user.findMany
        .mockResolvedValueOnce(expiredUsers)
        .mockResolvedValueOnce([]);

      prismaMock.user.delete
        .mockRejectedValueOnce(new Error("DB constraint error"))
        .mockResolvedValueOnce({});

      const result = await cron.handleCron();

      expect(result).toBe(1);
      expect(prismaMock.user.delete).toHaveBeenCalledTimes(2);
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        "lock:cron:user-cleanup",
      );
    });
  });
});
