import { describe, expect, it, vi } from "vitest";

import {
  type AmqpMessage,
  PushConsumer,
  parseEnvelope,
  type QueueNames,
  resolveQueueNames,
} from "./push-consumer";
import {
  DEAD_LETTER_REASON_HEADER,
  MAX_DELIVERIES,
  RETRY_DELAYS_MS,
  RETRY_HEADER,
} from "./push-delivery";

const QUEUE = "telegram.notifications";

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

interface Harness {
  consumer: PushConsumer;
  sendMessage: ReturnType<typeof vi.fn>;
  ack: ReturnType<typeof vi.fn>;
  nack: ReturnType<typeof vi.fn>;
  sendToQueue: ReturnType<typeof vi.fn>;
  asserted: Array<{ name: string; options: Record<string, unknown> }>;
  consumed: { queue: string; prefetch: number | undefined } | undefined;
}

const message = (
  patch: { messageId?: string; headers?: Record<string, unknown> } = {},
): AmqpMessage => ({
  content: Buffer.from(JSON.stringify(ENVELOPE), "utf8"),
  // `properties` — так выглядит реальное сообщение amqplib: `messageId` и
  // заголовки лежат именно там, а не в `fields`.
  properties: {
    messageId: patch.messageId ?? "dedup-key",
    ...(patch.headers === undefined ? {} : { headers: patch.headers }),
  },
  fields: {},
});

function build(api?: { sendMessage: ReturnType<typeof vi.fn> }): Harness {
  const sendMessage =
    api?.sendMessage ?? vi.fn().mockResolvedValue({ message_id: 1 });
  const ack = vi.fn();
  const nack = vi.fn();
  const sendToQueue = vi.fn().mockResolvedValue(true);
  const asserted: Harness["asserted"] = [];
  let consumed: Harness["consumed"];

  let setupDone: Promise<unknown> = Promise.resolve();

  const raw = {
    sendToQueue,
    consume: vi
      .fn()
      .mockImplementation(
        async (
          queue: string,
          _onMessage: (m: AmqpMessage) => void,
          options?: { prefetch?: number },
        ) => {
          // Брокер объявляет очереди в `setup` до подписки, и `consume` ждёт
          // его завершения — иначе тест читал бы `asserted` до объявления.
          await setupDone;
          consumed = { queue, prefetch: options?.prefetch };
          return { consumerTag: "tag" };
        },
      ),
    ack,
    nack,
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  };

  const createConnection = () => ({
    createChannel: (options: {
      setup?: (channel: unknown) => Promise<void>;
    }) => {
      // `setup` вызывается брокером при каждом подключении; здесь он
      // выполняется сразу, чтобы проверить объявление очередей.
      setupDone = options.setup
        ? options.setup({
            assertQueue: (name: string, opts: Record<string, unknown>) => {
              asserted.push({ name, options: opts });
              return Promise.resolve({ queue: name });
            },
          })
        : Promise.resolve();
      return raw as never;
    },
    close: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
  });

  const consumer = new PushConsumer({
    url: "amqp://localhost",
    queue: QUEUE,
    prefetch: 10,
    webAppUrl: "https://app.example.com",
    api: { sendMessage } as never,
    createConnection: createConnection as never,
  });

  return {
    consumer,
    sendMessage,
    ack,
    nack,
    sendToQueue,
    asserted,
    get consumed() {
      return consumed;
    },
  } as Harness;
}

describe("resolveQueueNames", () => {
  it("DLQ и очереди повторов выводятся из имени основной очереди", () => {
    const names: QueueNames = resolveQueueNames("custom.queue");

    expect(names.main).toBe("custom.queue");
    expect(names.dlq).toBe("custom.queue.dlq");
    expect(names.retry).toEqual([
      "custom.queue.retry.1",
      "custom.queue.retry.2",
      "custom.queue.retry.3",
      "custom.queue.retry.4",
      "custom.queue.retry.5",
    ]);
    expect(names.rateLimit).toBe("custom.queue.rate-limit");
  });
});

describe("PushConsumer: объявление очередей", () => {
  it("основная очередь объявлена ровно как у продюсера в API", async () => {
    const harness = build();
    await harness.consumer.start();

    const main = harness.asserted.find(
      (q) => q.name === "telegram.notifications",
    );
    // Продюсер в `apps/api` объявляет очередь как `{ durable: true }`, и любое
    // дополнительное отличие превращает второе объявление в 406: бот перестаёт
    // получать уведомления либо ломает публикацию в API.
    expect(main?.options).toEqual({ durable: true });
  });

  it("DLQ хранит сообщения 7 дней", async () => {
    const harness = build();
    await harness.consumer.start();

    expect(
      harness.asserted.find((q) => q.name === "telegram.notifications.dlq")
        ?.options,
    ).toMatchObject({ durable: true, messageTtl: 7 * 24 * 60 * 60 * 1000 });
  });

  it("у каждой очереди повтора свой TTL и возврат в основную очередь", async () => {
    const harness = build();
    await harness.consumer.start();

    const retries = harness.asserted.filter((q) =>
      q.name.startsWith("telegram.notifications.retry."),
    );
    expect(retries.map((q) => q.options.messageTtl)).toEqual([
      ...RETRY_DELAYS_MS,
    ]);
    for (const retry of retries) {
      expect(retry.options).toMatchObject({
        durable: true,
        deadLetterExchange: "",
        deadLetterRoutingKey: "telegram.notifications",
      });
    }
  });

  it("очередь пауз Telegram объявлена без TTL: задержка задаётся сообщением", async () => {
    const harness = build();
    await harness.consumer.start();

    const rateLimit = harness.asserted.find(
      (q) => q.name === "telegram.notifications.rate-limit",
    );
    // `messageTtl` на очереди ограничил бы `retry_after` сверху, а Telegram
    // просит ждать и 30, и 300 секунд.
    expect(rateLimit?.options).toEqual({
      durable: true,
      deadLetterExchange: "",
      deadLetterRoutingKey: "telegram.notifications",
    });
  });

  it("потребление поднимается с prefetch из конфигурации", async () => {
    const harness = build();
    await harness.consumer.start();

    expect(harness.consumed).toEqual({
      queue: "telegram.notifications",
      prefetch: 10,
    });
  });
});

describe("PushConsumer: успешная доставка", () => {
  it("шлёт сообщение в чат получателя и подтверждает доставку", async () => {
    const harness = build();
    await harness.consumer.start();

    await harness.consumer.handle(message());

    expect(harness.sendMessage).toHaveBeenCalledWith(
      "-100500",
      expect.stringContaining("Анна предлагает провести интервью"),
      expect.objectContaining({ link_preview_options: { is_disabled: true } }),
    );
    expect(harness.ack).toHaveBeenCalledTimes(1);
    expect(harness.nack).not.toHaveBeenCalled();
  });

  it("кнопка ведёт на WEB_APP_URL, когда в конверте есть actionUrl", async () => {
    const harness = build();
    await harness.consumer.start();

    const withUrl = message();
    withUrl.content = Buffer.from(
      JSON.stringify({ ...ENVELOPE, actionUrl: "/me" }),
      "utf8",
    );
    await harness.consumer.handle(withUrl);

    const options = harness.sendMessage.mock.calls[0][2] as {
      reply_markup?: { inline_keyboard?: Array<Array<{ url?: string }>> };
    };
    expect(options.reply_markup?.inline_keyboard?.[0]?.[0]?.url).toBe(
      "https://app.example.com/me",
    );
  });

  it("повтор того же messageId не отправляет сообщение второй раз", async () => {
    const harness = build();
    await harness.consumer.start();

    await harness.consumer.handle(message({ messageId: "m-1" }));
    await harness.consumer.handle(message({ messageId: "m-1" }));

    expect(harness.sendMessage).toHaveBeenCalledTimes(1);
    expect(harness.ack).toHaveBeenCalledTimes(2);
  });

  it("дубликат, доставляемый параллельно, ждёт первой доставки", async () => {
    const harness = build();
    await harness.consumer.start();

    await Promise.all([
      harness.consumer.handle(message({ messageId: "m-parallel" })),
      harness.consumer.handle(message({ messageId: "m-parallel" })),
    ]);

    expect(harness.sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe("PushConsumer: повторы и DLQ", () => {
  const failing = (err: unknown) =>
    build({ sendMessage: vi.fn().mockRejectedValue(err) });

  it("временная ошибка уходит в очередь повтора с увеличенным счётчиком", async () => {
    const harness = failing(new TypeError("fetch failed"));
    await harness.consumer.start();

    await harness.consumer.handle(message());

    expect(harness.sendToQueue).toHaveBeenCalledWith(
      "telegram.notifications.retry.1",
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        messageId: "dedup-key",
        headers: { [RETRY_HEADER]: 1 },
      }),
    );
    expect(harness.ack).toHaveBeenCalledTimes(1);
    expect(harness.nack).not.toHaveBeenCalled();
  });

  it("номер очереди повтора растёт вместе со счётчиком", async () => {
    const harness = failing(new TypeError("fetch failed"));
    await harness.consumer.start();

    await harness.consumer.handle(message({ headers: { [RETRY_HEADER]: 3 } }));

    expect(harness.sendToQueue.mock.calls[0][0]).toBe(
      "telegram.notifications.retry.4",
    );
  });

  it("тело сообщения при повторе не переписывается", async () => {
    const harness = failing(new TypeError("fetch failed"));
    await harness.consumer.start();

    const original = message();
    await harness.consumer.handle(original);

    expect(harness.sendToQueue.mock.calls[0][1]).toEqual(original.content);
  });

  it("после исчерпания попыток сообщение уходит в DLQ, а не в новый повтор", async () => {
    const harness = failing(new TypeError("fetch failed"));
    await harness.consumer.start();

    await harness.consumer.handle(
      message({ headers: { [RETRY_HEADER]: MAX_DELIVERIES - 1 } }),
    );

    expect(harness.sendToQueue.mock.calls[0][0]).toBe(
      "telegram.notifications.dlq",
    );
    expect(harness.ack).toHaveBeenCalledTimes(1);
    expect(harness.nack).not.toHaveBeenCalled();
  });

  it("bot.ban уходит в DLQ сразу, не расходуя попытки", async () => {
    const { GrammyError } = await import("grammy");
    const banned = new GrammyError(
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
    const harness = failing(banned);
    await harness.consumer.start();

    await harness.consumer.handle(message());

    expect(harness.sendToQueue.mock.calls[0][0]).toBe(
      "telegram.notifications.dlq",
    );
    expect(harness.ack).toHaveBeenCalledTimes(1);
    expect(harness.nack).not.toHaveBeenCalled();
  });

  it("в DLQ записывается причина ухода", async () => {
    const harness = failing(new TypeError("fetch failed"));
    await harness.consumer.start();

    // Последняя допустимая попытка: дальше сообщение уходит в DLQ, и оператор
    // должен видеть в нём исходное сообщение и причину.
    await harness.consumer.handle(
      message({ headers: { [RETRY_HEADER]: MAX_DELIVERIES - 1 } }),
    );

    // Причина обязана быть в заголовках публикации в DLQ: `nack` брокера
    // переносил бы в DLQ исходные свойства, и оператор не увидел бы её.
    expect(harness.sendToQueue).toHaveBeenCalledWith(
      "telegram.notifications.dlq",
      expect.any(Buffer),
      expect.objectContaining({
        persistent: true,
        headers: expect.objectContaining({
          [DEAD_LETTER_REASON_HEADER]: "fetch failed",
        }) as Record<string, unknown>,
      }),
    );
  });

  it("неудачная публикация в DLQ возвращает оригинал в очередь", async () => {
    const { GrammyError } = await import("grammy");
    const banned = new GrammyError(
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
    const harness = failing(banned);
    harness.sendToQueue.mockRejectedValue(new Error("channel closed"));
    await harness.consumer.start();

    await harness.consumer.handle(message());

    expect(harness.ack).not.toHaveBeenCalled();
    expect(harness.nack).toHaveBeenCalledWith(expect.anything(), false, true);
  });

  it("rate limit Telegram повторяется, а не уходит в DLQ", async () => {
    const { GrammyError } = await import("grammy");
    const rateLimited = new GrammyError(
      "Too Many Requests: retry after 30",
      {
        ok: false,
        error_code: 429,
        description: "Too Many Requests: retry after 30",
        parameters: { retry_after: 30 },
      },
      "sendMessage",
      {},
    );
    const harness = failing(rateLimited);
    await harness.consumer.start();

    await harness.consumer.handle(message());

    // Telegram попросил 30 секунд, лестница повторов дала бы 1: повтор раньше
    // срока гарантированно получил бы ещё один 429 и сжёг бы попытку впустую.
    expect(harness.sendToQueue).toHaveBeenCalledWith(
      "telegram.notifications.rate-limit",
      expect.any(Buffer),
      expect.objectContaining({
        expiration: 30_000,
        headers: { [RETRY_HEADER]: 1 },
      }),
    );
    expect(harness.nack).not.toHaveBeenCalled();
  });

  it("retry_after короче ступени лестницы не меняет маршрут", async () => {
    const { GrammyError } = await import("grammy");
    const rateLimited = new GrammyError(
      "Too Many Requests: retry after 1",
      {
        ok: false,
        error_code: 429,
        description: "Too Many Requests: retry after 1",
        parameters: { retry_after: 1 },
      },
      "sendMessage",
      {},
    );
    const harness = failing(rateLimited);
    await harness.consumer.start();

    await harness.consumer.handle(message());

    expect(harness.sendToQueue.mock.calls[0][0]).toBe(
      "telegram.notifications.retry.1",
    );
  });

  it("после неудачной отправки тот же messageId доставляется заново", async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValue({ message_id: 2 });
    const harness = build({ sendMessage });
    await harness.consumer.start();

    // Первая попытка ушла в очередь повтора, но не доставилась. Повтор несёт
    // тот же `messageId` и обязан быть обработан, а не погашен как дубликат.
    await harness.consumer.handle(message({ messageId: "m-retry" }));
    await harness.consumer.handle(
      message({ messageId: "m-retry", headers: { [RETRY_HEADER]: 1 } }),
    );

    expect(sendMessage).toHaveBeenCalledTimes(2);
    expect(harness.ack).toHaveBeenCalledTimes(2);
  });

  it("неудачная публикация копии возвращает оригинал в очередь", async () => {
    const harness = failing(new TypeError("fetch failed"));
    harness.sendToQueue.mockRejectedValue(new Error("channel closed"));
    await harness.consumer.start();

    await harness.consumer.handle(message());

    expect(harness.ack).not.toHaveBeenCalled();
    expect(harness.nack).toHaveBeenCalledWith(expect.anything(), false, true);
  });

  it("нечитаемый конверт уходит в DLQ без обращения к Telegram", async () => {
    const harness = build();
    await harness.consumer.start();

    const broken = message();
    broken.content = Buffer.from("{not json", "utf8");
    await harness.consumer.handle(broken);

    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(harness.sendToQueue.mock.calls[0][0]).toBe(
      "telegram.notifications.dlq",
    );
  });

  it("конверт без адреса не отправляется и уходит в DLQ", async () => {
    const harness = build();
    await harness.consumer.start();

    const { chatId: _chatId, ...withoutChatId } = ENVELOPE;
    await harness.consumer.handle({
      content: Buffer.from(JSON.stringify(withoutChatId), "utf8"),
      fields: {},
    });

    expect(harness.sendMessage).not.toHaveBeenCalled();
    expect(harness.sendToQueue.mock.calls[0][0]).toBe(
      "telegram.notifications.dlq",
    );
  });

  it("остановка закрывает канал и соединение и повторный вызов безопасен", async () => {
    const harness = build();
    await harness.consumer.start();

    await harness.consumer.stop();
    await harness.consumer.stop();
  });
});

describe("parseEnvelope", () => {
  it("возвращает адрес, локаль, таймзону и событие", () => {
    const parsed = parseEnvelope(message());

    expect(parsed).toEqual({
      event: ENVELOPE.event,
      chatId: "-100500",
      locale: "ru",
      timeZone: "Europe/Moscow",
    });
  });

  it("отсутствующий actionUrl не добавляется в конверт", () => {
    expect("actionUrl" in parseEnvelope(message())).toBe(false);
  });

  it("пустой чат, локаль или таймзона отвергаются", () => {
    for (const field of ["chatId", "locale", "timeZone"]) {
      const content = Buffer.from(
        JSON.stringify({ ...ENVELOPE, [field]: "" }),
        "utf8",
      );
      expect(() => parseEnvelope({ content, fields: {} })).toThrow(field);
    }
  });
});
