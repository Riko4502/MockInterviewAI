import { Logger } from "@nestjs/common";
import { MatchRequestStatus } from "../../generated/prisma/enums";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import {
  MATCHMAKING_EXPIRY_LOCK_KEY,
  MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS,
} from "./matchmaking.constants";
import { MatchmakingCronService } from "./matchmaking-cron.service";

describe("MatchmakingCronService", () => {
  let cron: MatchmakingCronService;
  let prismaMock: {
    matchRequest: {
      updateMany: jest.Mock;
    };
  };
  let redisServiceMock: {
    setNx: jest.Mock;
    get: jest.Mock;
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
      matchRequest: {
        updateMany: jest.fn(),
      },
    };

    redisServiceMock = {
      setNx: jest.fn().mockResolvedValue(true),
      get: jest.fn().mockImplementation(() => {
        return redisServiceMock.setNx.mock.calls[0]?.[1] ?? "token";
      }),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    cron = new MatchmakingCronService(
      prismaMock as unknown as PrismaService,
      redisServiceMock as unknown as RedisService,
    );
  });

  it("should be defined", () => {
    expect(cron).toBeDefined();
  });

  describe("handleCron", () => {
    it("успешно захватывает лок, переводит просроченные заявки в EXPIRED и освобождает лок", async () => {
      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 4 });

      const result = await cron.handleCron();

      expect(redisServiceMock.setNx).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
        expect.any(String),
        MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS,
      );

      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledTimes(1);
      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: {
          status: MatchRequestStatus.PENDING,
          expiresAt: { lte: expect.any(Date) },
        },
        data: {
          status: MatchRequestStatus.EXPIRED,
        },
      });

      expect(result).toEqual({ expired: 4 });
      expect(redisServiceMock.get).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
      );
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
      );
    });

    it("пропускает выполнение задачи, если лок уже занят другой репликой", async () => {
      redisServiceMock.setNx.mockResolvedValueOnce(false);

      const result = await cron.handleCron();

      expect(result).toEqual({ expired: 0 });
      expect(prismaMock.matchRequest.updateMany).not.toHaveBeenCalled();
      expect(redisServiceMock.delete).not.toHaveBeenCalled();
    });

    it("корректно перехватывает ошибку БД и гарантированно освобождает лок в finally", async () => {
      prismaMock.matchRequest.updateMany.mockRejectedValueOnce(
        new Error("Database connection error"),
      );

      const result = await cron.handleCron();

      expect(result).toEqual({ expired: 0 });
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
      );
    });

    it("не удаляет лок, если токен изменился (другая нода уже перехватила лок после TTL)", async () => {
      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 1 });
      // Возвращаем чужой токен
      redisServiceMock.get.mockResolvedValueOnce("another-instance-token");

      await cron.handleCron();

      expect(redisServiceMock.delete).not.toHaveBeenCalled();
    });
  });

  describe("processExpiredRequests", () => {
    it("выполняет атомарный updateMany для просроченных PENDING заявок", async () => {
      prismaMock.matchRequest.updateMany.mockResolvedValueOnce({ count: 7 });

      const result = await cron.processExpiredRequests();

      expect(result).toEqual({ expired: 7 });
      expect(prismaMock.matchRequest.updateMany).toHaveBeenCalledWith({
        where: {
          status: MatchRequestStatus.PENDING,
          expiresAt: { lte: expect.any(Date) },
        },
        data: {
          status: MatchRequestStatus.EXPIRED,
        },
      });
    });
  });
});
