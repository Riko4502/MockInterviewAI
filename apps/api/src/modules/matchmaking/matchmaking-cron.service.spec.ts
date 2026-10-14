import { Logger } from "@nestjs/common";
import {
  AvailabilitySlotStatus,
  MatchRequestStatus,
} from "../../generated/prisma/enums";
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
      findMany: jest.Mock;
      updateManyAndReturn: jest.Mock;
    };
    availabilitySlot: {
      updateMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let redisServiceMock: {
    setNx: jest.Mock;
    compareAndDelete: jest.Mock;
  };

  const expiredRequestId = "55555555-5555-4555-a555-555555555555";
  const expiredRequestId2 = "66666666-6666-4666-a666-666666666666";

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
        findMany: jest.fn().mockResolvedValue([]),
        updateManyAndReturn: jest.fn().mockResolvedValue([]),
      },
      availabilitySlot: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      $transaction: jest.fn((callback) => callback(prismaMock)),
    };

    redisServiceMock = {
      setNx: jest.fn().mockResolvedValue(true),
      compareAndDelete: jest.fn().mockResolvedValue(true),
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
      prismaMock.matchRequest.findMany.mockResolvedValueOnce([
        { id: expiredRequestId },
        { id: expiredRequestId2 },
      ]);
      prismaMock.matchRequest.updateManyAndReturn.mockResolvedValueOnce([
        { id: expiredRequestId },
        { id: expiredRequestId2 },
      ]);
      prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
        count: 2,
      });

      const result = await cron.handleCron();

      expect(redisServiceMock.setNx).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
        expect.any(String),
        MATCHMAKING_EXPIRY_LOCK_TTL_SECONDS,
      );

      expect(prismaMock.matchRequest.updateManyAndReturn).toHaveBeenCalledWith({
        where: {
          id: { in: [expiredRequestId, expiredRequestId2] },
          status: MatchRequestStatus.PENDING,
        },
        data: { status: MatchRequestStatus.EXPIRED },
        select: { id: true },
      });

      expect(prismaMock.availabilitySlot.updateMany).toHaveBeenCalledWith({
        where: {
          status: AvailabilitySlotStatus.BOOKED,
          bookedByRequestId: {
            in: [expiredRequestId, expiredRequestId2],
          },
        },
        data: { status: AvailabilitySlotStatus.OPEN, bookedByRequestId: null },
      });

      expect(result).toEqual({ expired: 2, slotsReleased: 2 });
      expect(redisServiceMock.compareAndDelete).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
        expect.any(String),
      );
    });

    it("освобождает слоты только у заявок, реально перешедших в EXPIRED", async () => {
      prismaMock.matchRequest.findMany.mockResolvedValueOnce([
        { id: expiredRequestId },
      ]);
      // Параллельный accept успел раньше: обновление не затронуло ни одной строки.
      prismaMock.matchRequest.updateManyAndReturn.mockResolvedValueOnce([]);

      const result = await cron.processExpiredRequests();

      expect(result).toEqual({ expired: 0, slotsReleased: 0 });
      expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
    });

    it("пропускает выполнение задачи, если лок уже занят другой репликой", async () => {
      redisServiceMock.setNx.mockResolvedValueOnce(false);

      const result = await cron.handleCron();

      expect(result).toEqual({ expired: 0, slotsReleased: 0 });
      expect(
        prismaMock.matchRequest.updateManyAndReturn,
      ).not.toHaveBeenCalled();
      expect(redisServiceMock.compareAndDelete).not.toHaveBeenCalled();
    });

    it("корректно перехватывает ошибку БД и гарантированно освобождает лок в finally", async () => {
      prismaMock.$transaction.mockRejectedValueOnce(
        new Error("Database connection error"),
      );

      const result = await cron.handleCron();

      expect(result).toEqual({ expired: 0, slotsReleased: 0 });
      expect(redisServiceMock.compareAndDelete).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
        expect.any(String),
      );
    });

    it("вызывает compareAndDelete именно с токеном текущей ноды", async () => {
      await cron.handleCron();

      const lockToken = redisServiceMock.setNx.mock.calls[0]?.[1];
      expect(lockToken).toBeDefined();
      expect(redisServiceMock.compareAndDelete).toHaveBeenCalledWith(
        MATCHMAKING_EXPIRY_LOCK_KEY,
        lockToken,
      );
    });
  });

  describe("processExpiredRequests", () => {
    it("не трогает БД, если истекающих заявок нет", async () => {
      const result = await cron.processExpiredRequests();

      expect(result).toEqual({ expired: 0, slotsReleased: 0 });
      expect(
        prismaMock.matchRequest.updateManyAndReturn,
      ).not.toHaveBeenCalled();
      expect(prismaMock.availabilitySlot.updateMany).not.toHaveBeenCalled();
    });

    it("выполняет атомарный перевод просроченных PENDING заявок и освобождает их слоты", async () => {
      prismaMock.matchRequest.findMany.mockResolvedValueOnce([
        { id: expiredRequestId },
      ]);
      prismaMock.matchRequest.updateManyAndReturn.mockResolvedValueOnce([
        { id: expiredRequestId },
      ]);
      prismaMock.availabilitySlot.updateMany.mockResolvedValueOnce({
        count: 1,
      });

      const result = await cron.processExpiredRequests();

      expect(result).toEqual({ expired: 1, slotsReleased: 1 });
      expect(prismaMock.matchRequest.findMany).toHaveBeenCalledWith({
        where: {
          status: MatchRequestStatus.PENDING,
          expiresAt: { lte: expect.any(Date) },
        },
        select: { id: true },
      });
    });

    it("повторяет транзакцию при конфликте сериализации P2034 и останавливается после успеха", async () => {
      const p2034 = Object.assign(new Error("Serialization conflict"), {
        code: "P2034",
      });

      prismaMock.$transaction.mockRejectedValueOnce(p2034);

      await expect(cron.processExpiredRequests()).resolves.toEqual({
        expired: 0,
        slotsReleased: 0,
      });

      // Конфликт повторяется один раз, успешная попытка завершает цикл.
      expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
    });

    it("пробрасывает исчерпанные конфликты сериализации наружу", async () => {
      const p2034 = Object.assign(new Error("Serialization conflict"), {
        code: "P2034",
      });

      prismaMock.$transaction.mockRejectedValue(p2034);

      await expect(cron.processExpiredRequests()).rejects.toThrow(
        "Serialization conflict",
      );
    });
  });
});
