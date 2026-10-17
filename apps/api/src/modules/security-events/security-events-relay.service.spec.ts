import { Logger } from "@nestjs/common";
import { SecurityEventType } from "../../generated/prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { RabbitMqPublisher } from "../notifications/rabbitmq-publisher.service";
import { SecurityEventsRelay } from "./security-events-relay.service";

describe("SecurityEventsRelay", () => {
  const EVENT_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const USER_ID = "11111111-1111-4111-a111-111111111111";
  const CHAT_ID = "987654321";

  let prismaMock: {
    securityEvent: {
      findMany: jest.Mock;
      findUniqueOrThrow: jest.Mock;
      updateMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let publisherMock: { publish: jest.Mock };
  let relay: SecurityEventsRelay;
  let previousNodeEnv: string | undefined;

  // `NODE_ENV` объявлен в типах как readonly, поэтому пишем через каст.
  const env = process.env as Record<string, string | undefined>;

  const baseRow = {
    id: EVENT_ID,
    type: SecurityEventType.GITHUB_UNLINKED,
    userId: USER_ID,
    ipAddress: "203.0.113.7",
    userAgent: "Mozilla/5.0",
    metadata: null,
    attempts: 0,
    createdAt: new Date("2026-09-10T12:00:00.000Z"),
    updatedAt: new Date("2026-09-10T12:00:00.000Z"),
    notifiedAt: null,
    deliverySkippedAt: null,
    seenAt: null,
    lastError: null,
    nextAttemptAt: new Date("2026-09-10T12:00:00.000Z"),
    user: {
      telegramChatId: CHAT_ID,
      telegramLinkVerified: true,
      telegramLocale: null,
      locale: "ru",
      timezone: "Europe/Moscow",
    },
  };

  beforeAll(() => {
    jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    // Релей намеренно молчит при NODE_ENV=test, а jest ставит именно его,
    // поэтому здесь проверяется боевая ветка.
    previousNodeEnv = env.NODE_ENV;
    env.NODE_ENV = "development";

    prismaMock = {
      securityEvent: {
        findMany: jest.fn().mockResolvedValue([]),
        findUniqueOrThrow: jest.fn().mockResolvedValue(baseRow),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue(baseRow),
      },
    };
    publisherMock = { publish: jest.fn().mockResolvedValue(undefined) };
    relay = new SecurityEventsRelay(
      prismaMock as unknown as PrismaService,
      publisherMock as unknown as RabbitMqPublisher,
    );
  });

  afterEach(() => {
    env.NODE_ENV = previousNodeEnv;
  });

  it("берёт только недоставленные строки с наступившим nextAttemptAt", async () => {
    await relay.relay();

    expect(prismaMock.securityEvent.findMany).toHaveBeenCalledWith({
      where: {
        notifiedAt: null,
        deliverySkippedAt: null,
        attempts: { lt: 5 },
        nextAttemptAt: { lte: expect.any(Date) },
      },
      orderBy: { nextAttemptAt: "asc" },
      take: 50,
      select: { id: true, attempts: true },
    });
  });

  it("забирает строку себе compare-and-swap по attempts в одном UPDATE", async () => {
    prismaMock.securityEvent.findMany.mockResolvedValue([
      { id: EVENT_ID, attempts: 0 },
    ]);

    await relay.relay();

    expect(prismaMock.securityEvent.updateMany).toHaveBeenCalledWith({
      where: {
        id: EVENT_ID,
        notifiedAt: null,
        deliverySkippedAt: null,
        attempts: 0,
      },
      data: { attempts: { increment: 1 } },
    });
  });

  it("не доставляет строку, которую уже забрал другой проход (CAS не прошёл)", async () => {
    prismaMock.securityEvent.findMany.mockResolvedValue([
      { id: EVENT_ID, attempts: 0 },
    ]);
    prismaMock.securityEvent.updateMany.mockResolvedValue({ count: 0 });

    await relay.relay();

    expect(prismaMock.securityEvent.findUniqueOrThrow).not.toHaveBeenCalled();
    expect(publisherMock.publish).not.toHaveBeenCalled();
  });

  it("публикует push-шаблон события с chatId, локалью и часовым поясом", async () => {
    prismaMock.securityEvent.findMany.mockResolvedValue([
      { id: EVENT_ID, attempts: 0 },
    ]);

    await relay.relay();

    expect(publisherMock.publish).toHaveBeenCalledWith(
      {
        event: {
          type: "security.github_unlinked",
          payload: { occurredAt: "2026-09-10T12:00:00.000Z" },
        },
        chatId: CHAT_ID,
        locale: "ru",
        timeZone: "Europe/Moscow",
      },
      // Идемпотентность: одна строка — одно сообщение (ADR-004:136).
      `security:${EVENT_ID}`,
    );
    expect(prismaMock.securityEvent.update).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { notifiedAt: expect.any(Date), lastError: null },
    });
  });

  it("TG_LINKED не имеет push-шаблона → помечается пропуском, но не доставляется", async () => {
    prismaMock.securityEvent.findMany.mockResolvedValue([
      { id: EVENT_ID, attempts: 0 },
    ]);
    prismaMock.securityEvent.findUniqueOrThrow.mockResolvedValue({
      ...baseRow,
      type: SecurityEventType.TG_LINKED,
    });

    await relay.relay();

    expect(publisherMock.publish).not.toHaveBeenCalled();
    expect(prismaMock.securityEvent.update).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { deliverySkippedAt: expect.any(Date) },
    });
    // notifiedAt остаётся null — именно по нему in-app выбирает события (D8).
    expect(prismaMock.securityEvent.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notifiedAt: expect.any(Date) }),
      }),
    );
  });

  it("у получателя нет подтверждённой привязки → пропуск, событие остаётся in-app", async () => {
    prismaMock.securityEvent.findMany.mockResolvedValue([
      { id: EVENT_ID, attempts: 0 },
    ]);
    prismaMock.securityEvent.findUniqueOrThrow.mockResolvedValue({
      ...baseRow,
      user: {
        ...baseRow.user,
        telegramChatId: null,
        telegramLinkVerified: false,
      },
    });

    await relay.relay();

    expect(publisherMock.publish).not.toHaveBeenCalled();
    expect(prismaMock.securityEvent.update).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: { deliverySkippedAt: expect.any(Date) },
    });
  });

  it("сбой публикации → nextAttemptAt с backoff и сохранённая причина", async () => {
    prismaMock.securityEvent.findMany.mockResolvedValue([
      { id: EVENT_ID, attempts: 1 },
    ]);
    publisherMock.publish.mockRejectedValue(new Error("broker down"));

    await relay.relay();

    expect(prismaMock.securityEvent.update).toHaveBeenCalledWith({
      where: { id: EVENT_ID },
      data: {
        nextAttemptAt: expect.any(Date),
        lastError: "broker down",
      },
    });
    // Не помечается доставленным: notifiedAt не трогается.
    expect(prismaMock.securityEvent.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ notifiedAt: expect.any(Date) }),
      }),
    );
  });

  it("обрабатывает остальные строки после сбоя предыдущей", async () => {
    const secondId = "bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    prismaMock.securityEvent.findMany.mockResolvedValue([
      { id: EVENT_ID, attempts: 0 },
      { id: secondId, attempts: 0 },
    ]);
    prismaMock.securityEvent.findUniqueOrThrow
      .mockResolvedValueOnce(baseRow)
      .mockResolvedValueOnce({ ...baseRow, id: secondId });
    publisherMock.publish
      .mockRejectedValueOnce(new Error("broker down"))
      .mockResolvedValueOnce(undefined);

    await relay.relay();

    expect(publisherMock.publish).toHaveBeenCalledTimes(2);
    expect(prismaMock.securityEvent.update).toHaveBeenCalledWith({
      where: { id: secondId },
      data: { notifiedAt: expect.any(Date), lastError: null },
    });
  });

  it("не ходит в БД при NODE_ENV=test", async () => {
    env.NODE_ENV = "test";

    await relay.relay();

    expect(prismaMock.securityEvent.findMany).not.toHaveBeenCalled();
  });
});
