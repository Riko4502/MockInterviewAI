import amqp from "amqplib";
import { GrammyError } from "grammy";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { PushConsumer } from "./push-consumer";
import { DEAD_LETTER_REASON_HEADER } from "./push-delivery";

/**
 * Проверка транспорта на живом брокере: DLQ, TTL очередей повторов и
 * dead-letter routing на моках выглядели бы корректно всегда — их проверяет
 * только настоящий RabbitMQ.
 *
 * Креды берутся из переменных окружения или корневого `.env` тем же способом,
 * что и `apps/api/test/integration/notification-stream-format.e2e-spec.ts`.
 * Если брокера нет, набор помечается пропущенным, а не падает: в CI RabbitMQ
 * не поднимается.
 */
const loadEnv = (): Record<string, string> => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    const envPath = path.resolve(__dirname, "../../../.env");
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

/**
 * Креды по умолчанию совпадают с `docker-compose.yml:110-111`: с другими тест
 * молча уходил бы в пропуск, не дойдя до объявления очередей.
 */
const DEFAULT_URL = `amqp://${fileEnv.RABBITMQ_USER ?? "mock_interview"}:${
  fileEnv.RABBITMQ_PASSWORD ?? "mock_interview_pass"
}@localhost:${fileEnv.RABBITMQ_PORT ?? "5672"}`;

const URL = process.env.RABBITMQ_URL ?? fileEnv.RABBITMQ_URL ?? DEFAULT_URL;
const QUEUE = "e2e.telegram.bot.notifications";
const ALL_QUEUES = [
  QUEUE,
  `${QUEUE}.dlq`,
  `${QUEUE}.rate-limit`,
  `${QUEUE}.retry.1`,
  `${QUEUE}.retry.2`,
  `${QUEUE}.retry.3`,
  `${QUEUE}.retry.4`,
  `${QUEUE}.retry.5`,
];
const RETRY_QUEUES = ALL_QUEUES.filter(
  (name) => name !== QUEUE && name !== `${QUEUE}.dlq`,
);

const ENVELOPE = {
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
};

const wait = async <T>(check: () => Promise<T>, attempts = 50) => {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await check();
    } catch (err) {
      lastError = err;
      if (process.env.DEBUG_LIVE) {
        process.stderr.write(
          `[live] attempt ${i} failed: ${(err as Error).message}\n`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError;
};

describe.skipIf(!URL)("PushConsumer на живом RabbitMQ", () => {
  let available = false;
  let control: amqp.ChannelModel;
  let consumer: PushConsumer;
  let sent: Array<{ chatId: unknown; text: unknown }> = [];
  let failure: Error | undefined;

  /**
   * Работа на отдельном канале: `checkQueue` несуществующей очереди закрывает
   * канал брокером, поэтому опрос обязан пересоздавать канал на каждой попытке.
   */
  const withChannel = async <T>(
    fn: (channel: amqp.Channel) => Promise<T>,
  ): Promise<T> => {
    const channel = await control.createChannel();
    // Слушатель `error` обязателен: закрытый брокером канал эмитит `error`,
    // и без слушателя это необработанное событие, из-за которого воркер
    // перестаёт исполнять таймеры — тест зависает вместо обычного ретрая.
    channel.on("error", () => undefined);
    try {
      return await fn(channel);
    } finally {
      // Закрытие канала, уже закрытого брокером, может не завершиться — ждать
      // его без предела нельзя, иначе опрос зависнет на первой же 404.
      await Promise.race([
        channel.close().catch(() => undefined),
        new Promise((resolve) => setTimeout(resolve, 1000)),
      ]);
    }
  };

  const depthOf = async (name: string) =>
    withChannel(
      async (channel) => (await channel.checkQueue(name)).messageCount,
    );

  const publish = (payload: unknown, messageId?: string) =>
    withChannel(async (channel) => {
      channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        ...(messageId === undefined ? {} : { messageId }),
      });
    });

  beforeAll(async () => {
    try {
      control = await amqp.connect(URL);
      await withChannel(async (channel) => {
        // Очереди предыдущего прогона удаляются: их объявление могло остаться с
        // другими аргументами, и брокер отверг бы новое объявление как
        // inequivalent, а не как «очередь уже есть».
        for (const name of ALL_QUEUES) {
          await channel.deleteQueue(name).catch(() => undefined);
        }
        await channel.assertQueue(QUEUE, { durable: true });
      });
    } catch (err) {
      console.warn(
        `[skipped] PushConsumer на живом RabbitMQ: ${URL} недоступен (${(err as Error).message})`,
      );
      available = false;
      return;
    }

    available = true;
    consumer = new PushConsumer({
      url: URL,
      queue: QUEUE,
      prefetch: 5,
      webAppUrl: "https://app.example.com",
      api: {
        sendMessage: (chatId: unknown, text: unknown) => {
          sent.push({ chatId, text });
          return failure === undefined
            ? Promise.resolve({ message_id: sent.length })
            : Promise.reject(failure);
        },
      } as never,
    });
    await consumer.start();

    // `start` намеренно не ждёт брокера, поэтому объявление очередей — это
    // отдельная точка синхронизации теста, а не следствие вызова `start`.
    await wait(async () => {
      await withChannel(async (channel) => {
        for (const name of ALL_QUEUES) {
          await channel.checkQueue(name);
        }
      });
    });
  }, 60_000);

  afterAll(async () => {
    if (!available) return;
    await consumer.stop();
    await withChannel(async (channel) => {
      for (const name of ALL_QUEUES) {
        await channel.deleteQueue(name).catch(() => undefined);
      }
    });
    await control.close();
  }, 60_000);

  const itIfRabbit = (name: string, body: () => Promise<void>) =>
    it(name, async () => {
      if (!available) {
        // Пропуск обязан быть виден: иначе набор выглядит зелёным, хотя DLQ и
        // TTL повторов на живой брокере не проверялись вовсе.
        console.warn(`[skipped] ${name}: RabbitMQ is not reachable at ${URL}`);
        return;
      }
      await body();
    });

  const bannedError = () =>
    new GrammyError(
      "Forbidden: bot was blocked by the user",
      {
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was blocked by the user",
        parameters: {},
      },
      "sendMessage",
      {},
    );

  itIfRabbit(
    "объявляет DLQ, очередь пауз и пять очередей повтора",
    async () => {
      // DLQ обязана существовать и переживать рестарт: без неё неотправленное
      // уведомление просто удалялось бы.
      const declared = await withChannel(async (channel) => {
        const names: string[] = [];
        for (const name of ALL_QUEUES) {
          names.push((await channel.checkQueue(name)).queue);
        }
        return names;
      });

      expect(declared).toEqual(ALL_QUEUES);
    },
  );

  itIfRabbit("доставляет сообщение в Telegram и подтверждает его", async () => {
    sent = [];
    await publish(ENVELOPE, "e2e-delivered");

    await wait(async () => {
      if (sent.length === 0) throw new Error("not delivered yet");
    });

    expect(sent[0].chatId).toBe("-100500");
    expect(String(sent[0].text)).toContain("Анна предлагает провести интервью");

    // Ack убирает сообщение из очереди: проверка глубины подтверждает, что оно
    // не осталось в брокере неподтверждённым.
    await wait(async () => {
      expect(await depthOf(QUEUE)).toBe(0);
    });
  });

  itIfRabbit(
    "уводит сообщение в реальную DLQ при bot.ban, без повторов",
    async () => {
      sent = [];
      failure = bannedError();
      try {
        await publish(ENVELOPE, "e2e-banned");

        const message = await wait(async () => {
          const msg = await withChannel(async (channel) =>
            channel.get(`${QUEUE}.dlq`, { noAck: false }),
          );
          if (msg === false) throw new Error("dlq is empty yet");
          return msg;
        });

        expect(String(message.content)).toContain("interview.match_proposed");
        // Причина обязана быть в самом DLQ-сообщении: `nack` брокера сохранил бы
        // исходные свойства, и оператор не увидел бы её.
        expect(message.properties.headers?.[DEAD_LETTER_REASON_HEADER]).toBe(
          "Forbidden: bot was blocked by the user",
        );
        await withChannel(async (channel) => {
          channel.ack(message);
        });

        // Ни в очередях повтора, ни в основной очереди сообщения быть не должно:
        // невосстановимая ошибка не должна ждать своей очереди повтора.
        for (const name of [QUEUE, ...RETRY_QUEUES]) {
          expect([name, await depthOf(name)]).toEqual([name, 0]);
        }
      } finally {
        failure = undefined;
      }
    },
  );

  itIfRabbit(
    "временная ошибка повторяется по TTL и в итоге доставляется",
    async () => {
      sent = [];
      failure = new TypeError("fetch failed");
      await publish(ENVELOPE, "e2e-retry");

      // Первый вызов sendMessage виден сразу (запись в `sent` до rejection),
      // затем сообщение уезжает в retry.1.
      await wait(async () => {
        expect(await depthOf(`${QUEUE}.retry.1`)).toBe(1);
        expect(sent).toHaveLength(1);
      });

      // Брокер умирает копию в основную очередь, и консьюмер шлёт снова. Сбой
      // убран, и вторая попытка подтверждается: полный цикл повтора на живом
      // брокере, а не на моке, где TTL кажется мгновенным.
      failure = undefined;
      await wait(async () => {
        expect(sent).toHaveLength(2);
      });
      await wait(async () => {
        expect(await depthOf(QUEUE)).toBe(0);
      });
    },
  );

  itIfRabbit(
    "тот же messageId после доставки повторно в Telegram не уходит",
    async () => {
      // Метка в имени отправителя позволяет отличать сообщения этого теста в
      // общем буфере доставок: `sent` разделяется всем набором, и считать по
      // абсолютной длине его нельзя.
      const tag = `dedup-${Math.random().toString(36).slice(2)}`;
      const messageId = `e2e-${tag}`;
      const tagged: unknown = {
        ...ENVELOPE,
        event: {
          ...ENVELOPE.event,
          payload: { ...ENVELOPE.event.payload, senderName: tag },
        },
      };

      await publish(tagged, messageId);
      await wait(async () => {
        expect(sent.filter((s) => String(s.text).includes(tag))).toHaveLength(
          1,
        );
      });

      await publish(tagged, messageId);
      await wait(async () => {
        expect(await depthOf(QUEUE)).toBe(0);
      });

      // Даём гипотетическому дублю время дойти до отправки и убеждаемся, что
      // его не было: транспорт at-least-once, и послать дважды нельзя.
      await new Promise((resolve) => setTimeout(resolve, 600));
      expect(sent.filter((s) => String(s.text).includes(tag))).toHaveLength(1);
    },
  );
});
