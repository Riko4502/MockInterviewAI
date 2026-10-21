import { Logger } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RedisService } from "../../redis/redis.service";
import { SECURITY_EVENT_RETENTION_BATCH_SIZE } from "./security-events.constants";
import { SecurityEventsRetentionCron } from "./security-events-retention.cron";

describe("SecurityEventsRetentionCron", () => {
  let prismaMock: {
    securityEvent: {
      findMany: jest.Mock;
      deleteMany: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let redisServiceMock: {
    setNx: jest.Mock;
    delete: jest.Mock;
  };
  let cron: SecurityEventsRetentionCron;
  let previousNodeEnv: string | undefined;

  // `NODE_ENV` объявлен в типах как readonly, поэтому пишем через каст.
  const env = process.env as Record<string, string | undefined>;

  const LOCK_KEY = "lock:cron:security-events-retention";

  function eventId(index: number): string {
    return `${String(index).padStart(8, "0")}-bbbb-4ccc-8ddd-eeeeeeeeeeee`;
  }

  beforeAll(() => {
    jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Крон намеренно молчит при NODE_ENV=test, а jest ставит именно его,
    // поэтому здесь проверяется боевая ветка.
    previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";

    prismaMock = {
      securityEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn().mockResolvedValue(undefined),
    };
    redisServiceMock = {
      setNx: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    cron = new SecurityEventsRetentionCron(
      prismaMock as unknown as PrismaService,
      redisServiceMock as unknown as RedisService,
    );
  });

  afterEach(() => {
    env.NODE_ENV = previousNodeEnv;
  });

  it("удаляет только события старше 12 месяцев и освобождает лок", async () => {
    prismaMock.securityEvent.findMany
      .mockResolvedValueOnce([{ id: eventId(1) }])
      .mockResolvedValueOnce([]);

    await cron.purgeExpired();

    expect(redisServiceMock.setNx).toHaveBeenCalledWith(LOCK_KEY, "1", 3600);

    const before = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const { where } = prismaMock.securityEvent.findMany.mock.calls[0][0];
    expect(where.createdAt.lt).toBeInstanceOf(Date);
    // Порог — ровно 12 месяцев назад (ADR-005:126).
    expect(Math.abs(where.createdAt.lt.getTime() - before)).toBeLessThan(5000);

    expect(prismaMock.securityEvent.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: [eventId(1)] } },
    });
    expect(redisServiceMock.delete).toHaveBeenCalledWith(LOCK_KEY);
  });

  it("ничего не делает, если просроченных событий нет", async () => {
    await cron.purgeExpired();

    expect(prismaMock.securityEvent.deleteMany).not.toHaveBeenCalled();
    expect(redisServiceMock.delete).toHaveBeenCalledWith(LOCK_KEY);
  });

  it("не заходит в чистку, если лок удерживает другая реплика", async () => {
    redisServiceMock.setNx.mockResolvedValue(false);

    await cron.purgeExpired();

    expect(prismaMock.securityEvent.findMany).not.toHaveBeenCalled();
    expect(redisServiceMock.delete).not.toHaveBeenCalled();
  });

  it("работает пакетами, пока база возвращает полные батчи", async () => {
    const fullBatch = Array.from(
      { length: SECURITY_EVENT_RETENTION_BATCH_SIZE },
      (_, index) => ({ id: eventId(index) }),
    );

    prismaMock.securityEvent.findMany
      .mockResolvedValueOnce(fullBatch)
      .mockResolvedValueOnce([{ id: eventId(9999) }])
      .mockResolvedValueOnce([]);

    await cron.purgeExpired();

    // 1-й проход: полный батч → цикл продолжается; 2-й: 1 строка → выход.
    expect(prismaMock.securityEvent.findMany).toHaveBeenCalledTimes(2);
    expect(prismaMock.securityEvent.deleteMany).toHaveBeenCalledTimes(2);
    expect(redisServiceMock.delete).toHaveBeenCalledWith(LOCK_KEY);
  });

  it("логирует ошибку, но всё равно освобождает лок", async () => {
    prismaMock.securityEvent.findMany.mockRejectedValue(new Error("db down"));

    await expect(cron.purgeExpired()).resolves.toBeUndefined();

    const errorSpy = jest.spyOn(Logger.prototype, "error");
    expect(errorSpy).toHaveBeenCalledWith(
      "Failed to purge expired security events",
      expect.stringContaining("db down"),
    );
    expect(redisServiceMock.delete).toHaveBeenCalledWith(LOCK_KEY);
  });

  it("не ходит в БД при NODE_ENV=test", async () => {
    env.NODE_ENV = "test";

    await cron.purgeExpired();

    expect(redisServiceMock.setNx).not.toHaveBeenCalled();
    expect(prismaMock.securityEvent.findMany).not.toHaveBeenCalled();
  });
});
