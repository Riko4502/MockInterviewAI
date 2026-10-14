import type { ConfigService } from "@nestjs/config";
import type { Channel, ChannelWrapper } from "amqp-connection-manager";
import type { ConsumeMessage } from "amqplib";

import {
  amqpConnectionFactory,
  RabbitMqPublisher,
  type TelegramPushEnvelope,
} from "../../src/modules/notifications/rabbitmq-publisher.service";

/**
 * Креды берём из корневого `.env` — тем же способом, что и
 * `notification-stream-format.e2e-spec.ts`, чтобы тест видел тот же брокер,
 * что и приложение в Docker. Переменные процесса имеют приоритет.
 */
const loadEnv = (): Record<string, string> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    const path = require("node:path") as typeof import("node:path");
    const envPath = path.resolve(__dirname, "../../../../.env");
    if (!fs.existsSync(envPath)) return {};
    const result: Record<string, string> = {};
    for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      result[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
    return result;
  } catch {
    return {};
  }
};

const fileEnv = loadEnv();
const URL =
  process.env.RABBITMQ_URL ??
  fileEnv.RABBITMQ_URL ??
  "amqp://mock_interview:mock_interview_pass@localhost:5672";

/**
 * Порт, на котором ничего не слушает: им проверяется поведение приложения при
 * недоступном брокере (ADR-004:140).
 */
const DEAD_URL = "amqp://mock_interview:mock_interview_pass@localhost:5673";

const QUEUE = "e2e.telegram.notifications";
const MESSAGE_ID = "interview.match_proposed:e2e";
const ENVELOPE: TelegramPushEnvelope = {
  event: {
    type: "interview.match_proposed",
    payload: {
      requestId: "22222222-2222-4222-a222-222222222222",
      proposedSlotId: "33333333-3333-4333-a333-333333333333",
      proposedStartUtc: "2026-11-01T10:00:00.000Z",
      senderName: "Анна",
    },
  },
  chatId: "-100500",
  locale: "ru",
  timeZone: "Europe/Moscow",
  actionUrl: "/me",
};

const makePublisher = (
  url: string,
  publishTimeoutMs: number,
  queue: string = QUEUE,
) => {
  const values: Record<string, unknown> = {
    "rabbitmq.url": url,
    "rabbitmq.queue": queue,
    "rabbitmq.publishTimeoutMs": publishTimeoutMs,
  };
  const config = {
    get: (key: string) => values[key],
  } as unknown as ConfigService;

  return new RabbitMqPublisher(config, amqpConnectionFactory);
};

describe("RabbitMqPublisher на живом RabbitMQ", () => {
  let available = false;
  let connection: ReturnType<typeof amqpConnectionFactory>;
  let channel: ChannelWrapper;

  beforeAll(async () => {
    connection = amqpConnectionFactory(URL, () => undefined);
    const probe = connection.createChannel({ setup: async () => undefined });
    // Обработчик обязателен: `ChannelWrapper` — EventEmitter, и ошибка setup
    // без слушателя стала бы необработанным событием и обрушила бы процесс,
    // вместо того чтобы просто не доставлять тест.
    probe.on("error", () => undefined);
    try {
      await probe.waitForConnect();
      channel = connection.createChannel({
        setup: async (ch: Channel) => {
          // `durable` обязан совпадать с объявлением продюсера: иначе брокер
          // отвечает 406 и тест падает на объявлении, а не на проверке.
          await ch.assertQueue(QUEUE, { durable: true });
          await ch.purgeQueue(QUEUE);
        },
      });
      channel.on("error", () => undefined);
      await channel.waitForConnect();
      available = true;
    } catch {
      available = false;
    }
  });

  afterAll(async () => {
    if (available) {
      await channel.deleteQueue(QUEUE).catch(() => undefined);
    }
    await channel?.close().catch(() => undefined);
    await connection?.close().catch(() => undefined);
  });

  const itIfRabbit = (name: string, body: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        console.warn(`[skipped] ${name}: RabbitMQ is not reachable at ${URL}`);
        return;
      }
      await body();
    });

  itIfRabbit(
    "публикует конверт, который читается консьюмером без потерь",
    async () => {
      const received = new Promise<ConsumeMessage>((resolve, reject) => {
        void channel
          .consume(QUEUE, (msg) => {
            if (msg !== null) resolve(msg);
          })
          .catch(reject);
      });

      const publisher = makePublisher(URL, 5000);
      await publisher.publish(ENVELOPE, MESSAGE_ID);

      const message = await received;
      expect(message.properties.messageId).toBe(MESSAGE_ID);
      // `persistent` — доставка переживает перезапуск брокера, иначе
      // уведомление терялось бы вместе с контейнером.
      expect(message.properties.deliveryMode).toBe(2);
      expect(JSON.parse(message.content.toString("utf8"))).toEqual(ENVELOPE);

      channel.ack(message);
      await publisher.onModuleDestroy();
    },
  );

  itIfRabbit("объявляет durable-очередь при первом подключении", async () => {
    const freshQueue = `${QUEUE}.durable`;
    const publisher = makePublisher(URL, 5000, freshQueue);

    // Продюсер сам объявляет очередь в `setup` канала: бот может стартовать
    // позже, и публикация не должна падать на отсутствующей очереди.
    await publisher.publish(ENVELOPE, MESSAGE_ID);

    const info = await channel.checkQueue(freshQueue);
    expect(info.queue).toBe(freshQueue);

    await channel.deleteQueue(freshQueue);
    await publisher.onModuleDestroy();
  });
});

describe("RabbitMqPublisher при недоступном брокере (ADR-004:140)", () => {
  it("отклоняет публикацию за publishTimeout, а не виснет бесконечно", async () => {
    const publisher = makePublisher(DEAD_URL, 1000);
    const startedAt = Date.now();

    // Строка outbox обязана остаться PENDING и быть повторена позже, поэтому
    // публикация обязана завершиться отказом за конечное время: зависший промис
    // держал бы релей и статус IN_FLIGHT строки навсегда.
    await expect(publisher.publish(ENVELOPE, MESSAGE_ID)).rejects.toThrow();

    expect(Date.now() - startedAt).toBeLessThan(15_000);
    await publisher.onModuleDestroy();
  });

  it("не поднимает соединение и не падает в конструкторе", () => {
    const config = {
      get: (key: string) => (key === "rabbitmq.url" ? DEAD_URL : undefined),
    } as unknown as ConfigService;

    expect(
      () => new RabbitMqPublisher(config, amqpConnectionFactory),
    ).not.toThrow();
  });

  it("ошибка доставки не выходит за пределы таймаута публикации", async () => {
    const publisher = makePublisher(DEAD_URL, 500);
    const startedAt = Date.now();

    await expect(publisher.publish(ENVELOPE, MESSAGE_ID)).rejects.toThrow();

    // Строка outbox остаётся PENDING и повторяется позже: релей не должен
    // ждать отказ дольше собственного интервала, иначе он встанет на первом
    // недоступном брокере.
    expect(Date.now() - startedAt).toBeLessThan(5_000);
    await publisher.onModuleDestroy();
  });
});
