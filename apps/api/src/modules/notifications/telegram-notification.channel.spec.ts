import { buildDedupKey } from "@packages/dto";

import type { PrismaService } from "../../prisma/prisma.service";
import type { NotificationChannelDelivery } from "./notification-channel.interface";
import type { RabbitMqPublisher } from "./rabbitmq-publisher.service";
import { TelegramNotificationChannel } from "./telegram-notification.channel";

describe("TelegramNotificationChannel", () => {
  const recipientId = "11111111-1111-4111-a111-111111111111";
  const event = {
    type: "interview.match_proposed" as const,
    payload: {
      requestId: "22222222-2222-4222-a222-222222222222",
      proposedSlotId: "33333333-3333-4333-a333-333333333333",
      proposedStartUtc: "2026-11-01T10:00:00.000Z",
      senderName: "Анна",
    },
  };

  const linkedUser = {
    telegramChatId: "-100500",
    telegramLinkVerified: true,
    telegramLocale: "en",
    locale: "ru",
    timezone: "America/New_York",
  };

  let prismaMock: { user: { findUnique: jest.Mock } };
  let publisherMock: { publish: jest.Mock };
  let channel: TelegramNotificationChannel;

  const delivery: NotificationChannelDelivery = {
    event,
    recipientId,
    actionUrl: "/matchmaking/requests/22222222-2222-4222-a222-222222222222",
  };

  beforeEach(() => {
    prismaMock = {
      user: { findUnique: jest.fn().mockResolvedValue(linkedUser) },
    };
    publisherMock = { publish: jest.fn().mockResolvedValue(undefined) };
    channel = new TelegramNotificationChannel(
      prismaMock as unknown as PrismaService,
      publisherMock as unknown as RabbitMqPublisher,
    );
  });

  it("кладёт в конверт адрес, локаль, зону и ссылку", async () => {
    await channel.deliver(delivery);

    expect(publisherMock.publish).toHaveBeenCalledWith(
      {
        event: {
          type: "interview.match_proposed",
          payload: event.payload,
        },
        chatId: "-100500",
        locale: "en",
        timeZone: "America/New_York",
        actionUrl: "/matchmaking/requests/22222222-2222-4222-a222-222222222222",
      },
      buildDedupKey(event, recipientId),
    );
  });

  it("передаёт messageId того же ключа идемпотентности, что и у in-app", async () => {
    await channel.deliver(delivery);

    expect(publisherMock.publish.mock.calls[0][1]).toBe(
      "interview.match_proposed:11111111-1111-4111-a111-111111111111:request=22222222-2222-4222-a222-222222222222&slot=33333333-3333-4333-a333-333333333333&start=2026-11-01T10:00:00.000Z",
    );
  });

  it("без actionUrl не добавляет поле ссылки", async () => {
    await channel.deliver({ event, recipientId });

    expect(publisherMock.publish.mock.calls[0][0]).not.toHaveProperty(
      "actionUrl",
    );
  });

  it("не публикует получателю без привязанного Telegram", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...linkedUser,
      telegramChatId: null,
    });

    await channel.deliver(delivery);

    expect(publisherMock.publish).not.toHaveBeenCalled();
  });

  it("не публикует получателю с неподтверждённой привязкой", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...linkedUser,
      telegramLinkVerified: false,
    });

    await channel.deliver(delivery);

    expect(publisherMock.publish).not.toHaveBeenCalled();
  });

  it("берёт локаль профиля, если выбор языка в боте не сделан", async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      ...linkedUser,
      telegramLocale: null,
    });

    await channel.deliver(delivery);

    expect(publisherMock.publish.mock.calls[0][0]).toMatchObject({
      locale: "ru",
    });
  });

  it("не роняет доставку, если получателя нет в базе", async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);

    await expect(channel.deliver(delivery)).resolves.toBeUndefined();
    expect(publisherMock.publish).not.toHaveBeenCalled();
  });

  it("не добавляет в payload'а события данные профиля получателя", async () => {
    await channel.deliver({ event, recipientId });

    const envelope = publisherMock.publish.mock.calls[0][0];
    // Payload события переносится как есть: он собран релеем из словаря
    // события, а канал не имеет права дописывать в него контакты получателя.
    expect(envelope.event.payload).toEqual(event.payload);
    expect(Object.keys(envelope).sort()).toEqual([
      "chatId",
      "event",
      "locale",
      "timeZone",
    ]);
  });
});
