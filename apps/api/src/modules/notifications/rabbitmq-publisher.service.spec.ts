import type { ConfigService } from "@nestjs/config";
import type { AmqpConnectionManager } from "amqp-connection-manager";

import {
  AMQP_CONNECTION_FACTORY,
  type AmqpConnectionFactory,
  RabbitMqPublisher,
  type TelegramPushEnvelope,
} from "./rabbitmq-publisher.service";

type ChannelMock = {
  sendToQueue: jest.Mock;
  close: jest.Mock;
  on: jest.Mock;
};

type ConnectionMock = {
  createChannel: jest.Mock;
  close: jest.Mock;
  on: jest.Mock;
};

describe("RabbitMqPublisher", () => {
  const envelope: TelegramPushEnvelope = {
    event: {
      type: "interview.slot_booked",
      payload: {
        sessionId: "22222222-2222-4222-a222-222222222222",
        slotId: "33333333-3333-4333-a333-333333333333",
        startUtc: "2026-11-01T10:00:00.000Z",
        otherParticipantName: "Иван",
      },
    },
    chatId: "-100500",
    locale: "ru",
    timeZone: "Europe/Moscow",
  };

  let channel: ChannelMock;
  let connection: ConnectionMock;
  let createConnection: AmqpConnectionFactory;
  let publisher: RabbitMqPublisher;

  const buildPublisher = (publishTimeoutMs = 50): RabbitMqPublisher => {
    const config = {
      get: (key: string) =>
        key === "rabbitmq.url"
          ? "amqp://user:pass@localhost:5672"
          : key === "rabbitmq.queue"
            ? "telegram.notifications"
            : publishTimeoutMs,
    };

    return new RabbitMqPublisher(
      config as unknown as ConfigService,
      createConnection,
    );
  };

  beforeEach(() => {
    channel = {
      sendToQueue: jest.fn().mockResolvedValue(true),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
    };
    connection = {
      createChannel: jest.fn().mockReturnValue(channel),
      close: jest.fn().mockResolvedValue(undefined),
      on: jest.fn().mockReturnThis(),
    };
    createConnection = jest
      .fn()
      .mockReturnValue(connection as unknown as AmqpConnectionManager);
    publisher = buildPublisher();
  });

  it("не поднимает соединение на старте и объявляет очередь в setup канала", async () => {
    expect(createConnection).not.toHaveBeenCalled();

    await publisher.publish(envelope, "msg-1");

    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(connection.createChannel).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "telegram-push",
        publishTimeout: 50,
        setup: expect.any(Function),
      }),
    );
  });

  it("передаёт в setup утверждение durable-очереди", async () => {
    const assertQueue = jest.fn().mockResolvedValue({ queue: "q" });
    connection.createChannel.mockImplementation(
      (options: { setup: (ch: { assertQueue: unknown }) => Promise<void> }) => {
        void options.setup({ assertQueue });
        return { ...channel, on: jest.fn().mockReturnThis() };
      },
    );

    await publisher.publish(envelope, "msg-1");

    expect(assertQueue).toHaveBeenCalledWith("telegram.notifications", {
      durable: true,
    });
  });

  it("публикует конверт с messageId и persistent", async () => {
    await publisher.publish(envelope, "interview.slot_booked:u:session=1");

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      "telegram.notifications",
      JSON.stringify(envelope),
      expect.objectContaining({
        contentType: "application/json",
        messageId: "interview.slot_booked:u:session=1",
        persistent: true,
      }),
    );
  });

  it("создаёт соединение и канал один раз на весь процесс", async () => {
    await publisher.publish(envelope, "msg-1");
    await publisher.publish(envelope, "msg-2");

    expect(createConnection).toHaveBeenCalledTimes(1);
    expect(connection.createChannel).toHaveBeenCalledTimes(1);
    expect(channel.sendToQueue).toHaveBeenCalledTimes(2);
  });

  it("не скрывает отказ брокера, чтобы релей оставил строку в PENDING", async () => {
    // Истечение `publishTimeout` реализовано внутри ChannelWrapper: таймер
    // стартует при постановке сообщения в очередь и срабатывает независимо от
    // того, подключён брокер или нет. На границе библиотеки это проверяется
    // интеграционным тестом с живым RabbitMQ.
    channel.sendToQueue.mockRejectedValue(new Error("timed out"));

    await expect(publisher.publish(envelope, "msg-1")).rejects.toThrow(
      "timed out",
    );
  });

  it("читает имя очереди из конфигурации", async () => {
    const publisherWithCustomQueue = new RabbitMqPublisher(
      {
        get: (key: string) =>
          key === "rabbitmq.url" ? "amqp://localhost" : "telegram.custom",
      } as unknown as ConfigService,
      createConnection,
    );

    await publisherWithCustomQueue.publish(envelope, "msg-1");

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      "telegram.custom",
      expect.any(String),
      expect.any(Object),
    );
  });

  it("отказывает публикацию без RABBITMQ_URL, а не поднимает соединение", async () => {
    const publisherWithoutUrl = new RabbitMqPublisher(
      { get: () => "" } as unknown as ConfigService,
      createConnection,
    );

    await expect(
      publisherWithoutUrl.publish(envelope, "msg-1"),
    ).rejects.toThrow("RABBITMQ_URL is not configured");
    expect(createConnection).not.toHaveBeenCalled();
  });

  it("закрывает канал и соединение при остановке приложения", async () => {
    await publisher.publish(envelope, "msg-1");

    await publisher.onModuleDestroy();

    expect(channel.close).toHaveBeenCalledTimes(1);
    expect(connection.close).toHaveBeenCalledTimes(1);
  });

  it("экспортирует токен фабрики для DI", () => {
    expect(typeof AMQP_CONNECTION_FACTORY).toBe("symbol");
  });
});
