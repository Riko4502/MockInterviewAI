import { Logger } from "@nestjs/common";

import type { MetricsService } from "../../common/metrics/metrics.service";
import { NotificationOutboxStatus } from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import {
  NotificationOutboxMonitor,
  OUTBOX_MAX_OLDEST_AGE_SECONDS,
  OUTBOX_MAX_PENDING_ROWS,
} from "./notification-outbox-monitor.service";

jest.mock("@sentry/nestjs", () => ({ captureMessage: jest.fn() }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sentryMock = require("@sentry/nestjs") as {
  captureMessage: jest.Mock;
};

describe("NotificationOutboxMonitor", () => {
  let prismaMock: {
    notificationOutbox: { count: jest.Mock; findFirst: jest.Mock };
  };
  let metricsMock: { setOutboxBacklog: jest.Mock };
  let loggerError: jest.SpyInstance;
  let sentryCapture: jest.SpyInstance;
  let monitor: NotificationOutboxMonitor;
  let previousNodeEnv: string | undefined;

  const env = process.env as Record<string, string | undefined>;

  const minutesAgo = (minutes: number) =>
    new Date(Date.now() - minutes * 60 * 1000);

  beforeEach(() => {
    previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";

    prismaMock = {
      notificationOutbox: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };
    metricsMock = { setOutboxBacklog: jest.fn() };

    monitor = new NotificationOutboxMonitor(
      prismaMock as unknown as PrismaService,
      metricsMock as unknown as MetricsService,
    );
    loggerError = jest
      .spyOn((monitor as unknown as { logger: Logger }).logger, "error")
      .mockImplementation(() => undefined);
    sentryCapture = sentryMock.captureMessage as jest.Mock;
    sentryCapture.mockClear();
  });

  afterEach(() => {
    env.NODE_ENV = previousNodeEnv;
    jest.restoreAllMocks();
  });

  it("отдаёт в метрики число неотправленных строк и возраст самой старой", async () => {
    prismaMock.notificationOutbox.count.mockImplementation(
      (args: { where: { status: NotificationOutboxStatus } }) =>
        Promise.resolve(args.where.status === "PENDING" ? 3 : 1),
    );
    prismaMock.notificationOutbox.findFirst.mockResolvedValue({
      createdAt: minutesAgo(2),
    });

    await monitor.check();

    expect(metricsMock.setOutboxBacklog).toHaveBeenCalledWith({
      pending: 3,
      failed: 1,
      oldestAgeSeconds: expect.any(Number),
    });
  });

  it("не поднимает алерт, пока буфер в пределах порогов", async () => {
    prismaMock.notificationOutbox.count.mockResolvedValue(
      OUTBOX_MAX_PENDING_ROWS,
    );
    prismaMock.notificationOutbox.findFirst.mockResolvedValue({
      createdAt: new Date(
        Date.now() - (OUTBOX_MAX_OLDEST_AGE_SECONDS - 5) * 1000,
      ),
    });

    await monitor.check();

    expect(loggerError).not.toHaveBeenCalled();
    expect(sentryCapture).not.toHaveBeenCalled();
  });

  it("поднимает алерт, когда самая старая строка старше порога", async () => {
    prismaMock.notificationOutbox.count.mockResolvedValue(1);
    prismaMock.notificationOutbox.findFirst.mockResolvedValue({
      createdAt: minutesAgo(OUTBOX_MAX_OLDEST_AGE_SECONDS / 60 + 1),
    });

    await monitor.check();

    expect(loggerError).toHaveBeenCalledWith(
      expect.stringContaining("outbox is not draining"),
    );
    expect(sentryCapture).toHaveBeenCalledWith(
      expect.stringContaining("outbox is not draining"),
      "error",
    );
  });

  it("поднимает алерт, когда неотправленных строк больше порога", async () => {
    prismaMock.notificationOutbox.count.mockImplementation(
      (args: { where: { status: NotificationOutboxStatus } }) =>
        Promise.resolve(
          args.where.status === "PENDING" ? OUTBOX_MAX_PENDING_ROWS + 1 : 0,
        ),
    );

    await monitor.check();

    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("не превращает один инцидент в алерт каждую минуту", async () => {
    prismaMock.notificationOutbox.count.mockResolvedValue(
      OUTBOX_MAX_PENDING_ROWS + 1,
    );

    await monitor.check();
    await monitor.check();
    await monitor.check();

    expect(loggerError).toHaveBeenCalledTimes(1);
  });

  it("не ходит в БД при NODE_ENV=test", async () => {
    env.NODE_ENV = "test";

    await monitor.check();

    expect(prismaMock.notificationOutbox.count).not.toHaveBeenCalled();
  });
});
