import type { PrismaService } from "../../../prisma/prisma.service";
import type { RedisService } from "../../../redis/redis.service";
import type { AuthSessionService } from "./auth-session.service";
import { SessionRevocationCron } from "./session-revocation.cron";

describe("SessionRevocationCron", () => {
  let cron: SessionRevocationCron;
  let prismaMock: {
    authRevocationTask: {
      findMany: jest.Mock;
      delete: jest.Mock;
    };
  };
  let redisServiceMock: {
    setNx: jest.Mock;
    delete: jest.Mock;
    publish: jest.Mock;
  };
  let sessionServiceMock: {
    revokeAllUserSessions: jest.Mock;
  };

  beforeEach(() => {
    prismaMock = {
      authRevocationTask: {
        findMany: jest.fn().mockResolvedValue([]),
        delete: jest.fn().mockResolvedValue(undefined),
      },
    };
    redisServiceMock = {
      setNx: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(1),
      publish: jest.fn().mockResolvedValue(undefined),
    };
    sessionServiceMock = {
      revokeAllUserSessions: jest.fn().mockResolvedValue(undefined),
    };

    cron = new SessionRevocationCron(
      prismaMock as unknown as PrismaService,
      redisServiceMock as unknown as RedisService,
      sessionServiceMock as unknown as AuthSessionService,
    );
  });

  describe("handleCron", () => {
    it("пропускает выполнение, если лок уже захвачен другим инстансом", async () => {
      redisServiceMock.setNx.mockResolvedValue(false);

      const result = await cron.handleCron();

      expect(result).toBe(0);
      expect(prismaMock.authRevocationTask.findMany).not.toHaveBeenCalled();
      expect(redisServiceMock.delete).not.toHaveBeenCalled();
    });

    it("успешно обрабатывает пачку задач, отзывает сессии и удаляет задачи", async () => {
      const date1 = new Date("2026-08-01T10:00:00.000Z");
      const date2 = new Date("2026-08-01T11:00:00.000Z");
      const mockTasks = [
        { id: "task-1", userId: "user-1", createdAt: date1 },
        { id: "task-2", userId: "user-2", createdAt: date2 },
      ];
      prismaMock.authRevocationTask.findMany.mockResolvedValue(mockTasks);

      const result = await cron.handleCron();

      expect(result).toBe(2);
      expect(sessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        "user-1",
        date1,
      );
      expect(sessionServiceMock.revokeAllUserSessions).toHaveBeenCalledWith(
        "user-2",
        date2,
      );
      expect(redisServiceMock.publish).toHaveBeenCalledWith(
        "auth:revocations",
        expect.stringContaining("user-1"),
      );
      expect(redisServiceMock.publish).toHaveBeenCalledWith(
        "auth:revocations",
        expect.stringContaining("user-2"),
      );
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-1" },
      });
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-2" },
      });
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        "lock:cron:session-revocation",
      );
    });

    it("при ошибке отзыва одной задачи продолжает обработку остальных и оставляет упавшую", async () => {
      const mockTasks = [
        { id: "task-fail", userId: "user-fail", createdAt: new Date() },
        { id: "task-ok", userId: "user-ok", createdAt: new Date() },
      ];
      prismaMock.authRevocationTask.findMany.mockResolvedValue(mockTasks);
      sessionServiceMock.revokeAllUserSessions
        .mockRejectedValueOnce(new Error("Redis unavailable"))
        .mockResolvedValueOnce(undefined);

      const result = await cron.handleCron();

      expect(result).toBe(1);
      expect(prismaMock.authRevocationTask.delete).not.toHaveBeenCalledWith({
        where: { id: "task-fail" },
      });
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-ok" },
      });
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        "lock:cron:session-revocation",
      );
    });

    it("при ошибке публикации оставляет задачу в БД и продолжает обработку", async () => {
      const mockTasks = [
        { id: "task-pub-fail", userId: "user-pub-fail", createdAt: new Date() },
        { id: "task-pub-ok", userId: "user-pub-ok", createdAt: new Date() },
      ];
      prismaMock.authRevocationTask.findMany.mockResolvedValue(mockTasks);
      redisServiceMock.publish
        .mockRejectedValueOnce(new Error("Redis Pub/Sub error"))
        .mockResolvedValueOnce(undefined);

      const result = await cron.handleCron();

      expect(result).toBe(1);
      expect(prismaMock.authRevocationTask.delete).not.toHaveBeenCalledWith({
        where: { id: "task-pub-fail" },
      });
      expect(prismaMock.authRevocationTask.delete).toHaveBeenCalledWith({
        where: { id: "task-pub-ok" },
      });
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        "lock:cron:session-revocation",
      );
    });
  });
});
