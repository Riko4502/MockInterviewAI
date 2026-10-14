import { NotificationOutboxStatus } from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { NotificationDispatcher } from "./notification-dispatcher.service";
import { NotificationOutboxRelay } from "./notification-outbox-relay.service";

describe("NotificationOutboxRelay", () => {
  const rowId = "outbox-1";

  const pendingRow = {
    id: rowId,
    type: "system.welcome",
    payload: {},
    recipientId: "11111111-1111-4111-a111-111111111111",
    category: "SYSTEM",
    actionUrl: null,
    status: NotificationOutboxStatus.PENDING,
    attempts: 0,
    nextAttemptAt: new Date(),
    processedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let prismaMock: {
    notificationOutbox: {
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let dispatcherMock: { deliver: jest.Mock };
  let relay: NotificationOutboxRelay;
  let previousNodeEnv: string | undefined;

  // `NODE_ENV` объявлен в типах как readonly, поэтому пишем через каст.
  const env = process.env as Record<string, string | undefined>;

  beforeEach(() => {
    // Релей намеренно молчит при NODE_ENV=test, а jest ставит именно его,
    // поэтому здесь проверяется боевая ветка.
    previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";

    prismaMock = {
      notificationOutbox: {
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue(pendingRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(pendingRow),
      },
    };
    dispatcherMock = { deliver: jest.fn().mockResolvedValue(undefined) };
    relay = new NotificationOutboxRelay(
      prismaMock as unknown as PrismaService,
      dispatcherMock as unknown as NotificationDispatcher,
    );
  });

  it("берёт только PENDING с наступившим nextAttemptAt", async () => {
    await relay.relay();

    expect(prismaMock.notificationOutbox.findMany).toHaveBeenCalledWith({
      where: {
        status: NotificationOutboxStatus.PENDING,
        nextAttemptAt: { lte: expect.any(Date) },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: 50,
    });
  });

  it("помечает доставленную строку DELIVERED с processedAt", async () => {
    prismaMock.notificationOutbox.findMany.mockResolvedValue([pendingRow]);

    await relay.relay();

    expect(prismaMock.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: rowId },
      data: {
        status: NotificationOutboxStatus.DELIVERED,
        processedAt: expect.any(Date),
        lastError: null,
      },
    });
  });

  it("не отдаёт строку в обработку, если её уже забрал другой проход", async () => {
    prismaMock.notificationOutbox.findMany.mockResolvedValue([pendingRow]);
    prismaMock.notificationOutbox.updateMany.mockResolvedValue({ count: 0 });

    await relay.relay();

    expect(dispatcherMock.deliver).not.toHaveBeenCalled();
    expect(prismaMock.notificationOutbox.update).not.toHaveBeenCalled();
  });

  it("забирает строку себе инкрементом attempts в одном UPDATE", async () => {
    prismaMock.notificationOutbox.findMany.mockResolvedValue([pendingRow]);

    await relay.relay();

    expect(prismaMock.notificationOutbox.updateMany).toHaveBeenCalledWith({
      where: {
        id: rowId,
        status: NotificationOutboxStatus.PENDING,
        attempts: 0,
      },
      data: { attempts: { increment: 1 } },
    });
  });

  it("возвращает строку в PENDING с отложенным nextAttemptAt при сбое", async () => {
    prismaMock.notificationOutbox.findMany.mockResolvedValue([pendingRow]);
    dispatcherMock.deliver.mockRejectedValue(new Error("channel down"));

    await relay.relay();

    expect(prismaMock.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: rowId },
      data: {
        status: NotificationOutboxStatus.PENDING,
        nextAttemptAt: expect.any(Date),
        lastError: "channel down",
      },
    });
  });

  it("переводит строку в FAILED после исчерпания попыток", async () => {
    const almostExhausted = { ...pendingRow, attempts: 4 };
    prismaMock.notificationOutbox.findMany.mockResolvedValue([almostExhausted]);
    prismaMock.notificationOutbox.findUniqueOrThrow.mockResolvedValue(
      almostExhausted,
    );
    dispatcherMock.deliver.mockRejectedValue(new Error("channel down"));

    await relay.relay();

    expect(prismaMock.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: rowId },
      data: expect.objectContaining({
        status: NotificationOutboxStatus.FAILED,
      }),
    });
  });

  it("не теряет причину сбоя", async () => {
    prismaMock.notificationOutbox.findMany.mockResolvedValue([pendingRow]);
    dispatcherMock.deliver.mockRejectedValue(new Error("channel down"));

    await relay.relay();

    expect(prismaMock.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: rowId },
      data: expect.objectContaining({ lastError: "channel down" }),
    });
  });

  it("продолжает обработку следующей строки после сбоя предыдущей", async () => {
    const second = { ...pendingRow, id: "outbox-2" };
    prismaMock.notificationOutbox.findMany.mockResolvedValue([
      pendingRow,
      second,
    ]);
    prismaMock.notificationOutbox.findUniqueOrThrow
      .mockResolvedValueOnce(pendingRow)
      .mockResolvedValueOnce(second);
    dispatcherMock.deliver
      .mockRejectedValueOnce(new Error("channel down"))
      .mockResolvedValueOnce(undefined);

    await relay.relay();

    expect(dispatcherMock.deliver).toHaveBeenCalledTimes(2);
    expect(prismaMock.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: "outbox-2" },
      data: expect.objectContaining({
        status: NotificationOutboxStatus.DELIVERED,
      }),
    });
  });

  afterEach(() => {
    env.NODE_ENV = previousNodeEnv;
  });

  it("не ходит в БД при NODE_ENV=test", async () => {
    env.NODE_ENV = "test";

    await relay.relay();

    expect(prismaMock.notificationOutbox.findMany).not.toHaveBeenCalled();
  });
});
