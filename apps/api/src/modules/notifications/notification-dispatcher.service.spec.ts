import type {
  NotificationChannel,
  NotificationChannelDelivery,
} from "./notification-channel.interface";
import { NOTIFICATION_CHANNELS } from "./notification-channel.interface";
import { NotificationDispatcher } from "./notification-dispatcher.service";

describe("NotificationDispatcher", () => {
  const recipientId = "11111111-1111-4111-a111-111111111111";

  const createdOutbox = {
    id: "outbox-1",
    type: "system.welcome",
    payload: {},
    recipientId,
    category: "SYSTEM",
    actionUrl: null,
    status: "PENDING",
    attempts: 0,
    nextAttemptAt: new Date(),
    processedAt: null,
    lastError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let prismaMock: { notificationOutbox: { create: jest.Mock } };
  let tx: { notificationOutbox: { create: jest.Mock } };
  let dispatcher: NotificationDispatcher;

  const welcomeEvent = { type: "system.welcome" as const, payload: {} };

  const buildChannel = (name: string): NotificationChannel => ({
    name,
    deliver: jest.fn().mockResolvedValue(undefined),
  });

  const makeDispatcher = (channels: NotificationChannel[]) =>
    new NotificationDispatcher(channels);

  beforeEach(() => {
    prismaMock = { notificationOutbox: { create: jest.fn() } };
    tx = { notificationOutbox: { create: jest.fn() } };
    tx.notificationOutbox.create.mockResolvedValue(createdOutbox);
    dispatcher = makeDispatcher([buildChannel("in-app")]);
  });

  describe("dispatch", () => {
    it("пишет событие в outbox через переданный транзакционный клиент", async () => {
      await dispatcher.dispatch(welcomeEvent, recipientId, tx as never);

      expect(tx.notificationOutbox.create).toHaveBeenCalledWith({
        data: {
          type: "system.welcome",
          payload: {},
          recipientId,
          category: "SYSTEM",
        },
      });
    });

    it("не пишет в prisma вне транзакции", async () => {
      await dispatcher.dispatch(welcomeEvent, recipientId, tx as never);

      expect(prismaMock.notificationOutbox.create).not.toHaveBeenCalled();
    });

    it("подставляет actionUrl только когда он задан", async () => {
      await dispatcher.dispatch(
        welcomeEvent,
        recipientId,
        tx as never,
        "/profile",
      );

      expect(tx.notificationOutbox.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ actionUrl: "/profile" }),
      });
    });

    it("отбрасывает поля вне словаря событий", async () => {
      await dispatcher.dispatch(
        {
          type: "system.welcome",
          payload: { email: "leak@example.com" },
        } as never,
        recipientId,
        tx as never,
      );

      const call = tx.notificationOutbox.create.mock.calls[0][0];

      expect(call.data.payload).not.toHaveProperty("email");
    });

    it("не пишет событие с неизвестным типом", async () => {
      await expect(
        dispatcher.dispatch(
          { type: "system.unknown", payload: {} } as never,
          recipientId,
          tx as never,
        ),
      ).rejects.toThrow();

      expect(tx.notificationOutbox.create).not.toHaveBeenCalled();
    });
  });

  describe("deliver", () => {
    it("разбирает строку outbox и отдаёт событие всем каналам", async () => {
      const first = buildChannel("in-app");
      const second = buildChannel("telegram");
      const multi = makeDispatcher([first, second]);

      await multi.deliver(createdOutbox as never);

      const expected: NotificationChannelDelivery = {
        event: welcomeEvent,
        recipientId,
      };

      expect(first.deliver).toHaveBeenCalledWith(expected);
      expect(second.deliver).toHaveBeenCalledWith(expected);
    });

    it("передаёт actionUrl каналу", async () => {
      const channel = buildChannel("in-app");
      const single = makeDispatcher([channel]);

      await single.deliver({
        ...createdOutbox,
        actionUrl: "/profile",
      } as never);

      expect(channel.deliver).toHaveBeenCalledWith(
        expect.objectContaining({ actionUrl: "/profile" }),
      );
    });

    it("передаёт каналу только поля payload", async () => {
      const channel = buildChannel("in-app");
      const single = makeDispatcher([channel]);

      await single.deliver({
        ...createdOutbox,
        type: "interview.match_proposed",
        payload: {
          requestId: "33333333-3333-4333-a333-333333333333",
          proposedSlotId: "44444444-4444-4444-a444-444444444444",
          proposedStartUtc: "2026-10-01T09:00:00.000Z",
          senderName: "Иван",
          email: "leak@example.com",
        },
      } as never);

      const delivery = (channel.deliver as jest.Mock).mock.calls[0][0] as {
        event: { payload: Record<string, unknown> };
      };

      expect(delivery.event.payload).not.toHaveProperty("email");
    });

    it("пробрасывает ошибку канала, чтобы релей мог повторить доставку", async () => {
      const failing: NotificationChannel = {
        name: "telegram",
        deliver: jest.fn().mockRejectedValue(new Error("queue down")),
      };

      await expect(
        makeDispatcher([failing]).deliver(createdOutbox as never),
      ).rejects.toThrow("queue down");
    });
  });

  describe("channelNames", () => {
    it("отдаёт имена зарегистрированных каналов", () => {
      const multi = makeDispatcher([
        buildChannel("in-app"),
        buildChannel("telegram"),
      ]);

      expect(multi.channelNames).toEqual(["in-app", "telegram"]);
    });
  });

  it("экспортирует токен для DI", () => {
    expect(typeof NOTIFICATION_CHANNELS).toBe("symbol");
  });
});
