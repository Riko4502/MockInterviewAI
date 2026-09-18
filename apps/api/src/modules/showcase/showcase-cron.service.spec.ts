import { Logger } from "@nestjs/common";
import { ShowcaseCardStatus } from "../../generated/prisma/enums";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { SHOWCASE_LIMITS } from "./showcase.constants";
import {
  SHOWCASE_EXPIRY_LOCK_KEY,
  SHOWCASE_EXPIRY_LOCK_TTL_SECONDS,
  ShowcaseCronService,
} from "./showcase-cron.service";

describe("ShowcaseCronService", () => {
  let cron: ShowcaseCronService;
  let prismaMock: {
    showcaseCard: {
      updateMany: jest.Mock;
    };
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
      showcaseCard: {
        updateMany: jest.fn(),
      },
    };

    redisServiceMock = {
      setNx: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    cron = new ShowcaseCronService(
      prismaMock as unknown as PrismaService,
      redisServiceMock as unknown as RedisService,
    );
  });

  it("should be defined", () => {
    expect(cron).toBeDefined();
  });

  describe("handleCron", () => {
    it("успешно захватывает лок, продлевает autoRenew карточки, экспирирует обычные и освобождает лок", async () => {
      // 1-й updateMany для autoRenew: true -> 3 обновлено
      // 2-й updateMany для autoRenew: false -> 5 обновлено
      prismaMock.showcaseCard.updateMany
        .mockResolvedValueOnce({ count: 3 })
        .mockResolvedValueOnce({ count: 5 });

      const result = await cron.handleCron();

      expect(redisServiceMock.setNx).toHaveBeenCalledWith(
        SHOWCASE_EXPIRY_LOCK_KEY,
        expect.any(String),
        SHOWCASE_EXPIRY_LOCK_TTL_SECONDS,
      );

      expect(prismaMock.showcaseCard.updateMany).toHaveBeenCalledTimes(2);

      // Проверяем первый updateMany (autoRenew = true)
      expect(prismaMock.showcaseCard.updateMany).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          where: expect.objectContaining({
            status: ShowcaseCardStatus.ACTIVE,
            autoRenew: true,
          }),
          data: expect.objectContaining({
            bumpedAt: expect.any(Date),
            expiresAt: expect.any(Date),
          }),
        }),
      );

      // Проверяем второй updateMany (autoRenew = false)
      expect(prismaMock.showcaseCard.updateMany).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          where: expect.objectContaining({
            status: ShowcaseCardStatus.ACTIVE,
            autoRenew: false,
          }),
          data: {
            status: ShowcaseCardStatus.EXPIRED,
          },
        }),
      );

      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        SHOWCASE_EXPIRY_LOCK_KEY,
      );

      expect(result).toEqual({ renewed: 3, expired: 5 });
    });

    it("пропускает выполнение, если другая реплика уже держит лок", async () => {
      redisServiceMock.setNx.mockResolvedValue(false);

      const result = await cron.handleCron();

      expect(result).toEqual({ renewed: 0, expired: 0 });
      expect(prismaMock.showcaseCard.updateMany).not.toHaveBeenCalled();
      expect(redisServiceMock.delete).not.toHaveBeenCalled();
    });

    it("корректно перехватывает ошибку БД и гарантированно освобождает лок в finally", async () => {
      prismaMock.showcaseCard.updateMany.mockRejectedValue(
        new Error("Database connection timeout"),
      );

      const result = await cron.handleCron();

      expect(result).toEqual({ renewed: 0, expired: 0 });
      expect(redisServiceMock.delete).toHaveBeenCalledWith(
        SHOWCASE_EXPIRY_LOCK_KEY,
      );
    });
  });

  describe("processExpiredCards", () => {
    it("продлевает срок карточек ровно на 15 дней (CARD_TTL_DAYS)", async () => {
      const fakeNow = new Date("2026-09-18T12:00:00.000Z");
      jest.useFakeTimers();
      jest.setSystemTime(fakeNow);

      prismaMock.showcaseCard.updateMany
        .mockResolvedValueOnce({ count: 2 })
        .mockResolvedValueOnce({ count: 1 });

      const result = await cron.processExpiredCards();

      const expectedExpiresAt = new Date(
        fakeNow.getTime() + SHOWCASE_LIMITS.CARD_TTL_DAYS * 24 * 60 * 60 * 1000,
      );

      expect(prismaMock.showcaseCard.updateMany).toHaveBeenNthCalledWith(1, {
        where: {
          status: ShowcaseCardStatus.ACTIVE,
          expiresAt: { lte: fakeNow },
          autoRenew: true,
        },
        data: {
          expiresAt: expectedExpiresAt,
          bumpedAt: fakeNow,
        },
      });

      expect(prismaMock.showcaseCard.updateMany).toHaveBeenNthCalledWith(2, {
        where: {
          status: ShowcaseCardStatus.ACTIVE,
          expiresAt: { lte: fakeNow },
          autoRenew: false,
        },
        data: {
          status: ShowcaseCardStatus.EXPIRED,
        },
      });

      expect(result).toEqual({ renewed: 2, expired: 1 });

      jest.useRealTimers();
    });
  });
});
