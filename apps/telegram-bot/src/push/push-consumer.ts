import {
  type Channel,
  type ChannelWrapper,
  connect,
} from "amqp-connection-manager";
import { type Api, InlineKeyboard } from "grammy";

import {
  classifyTelegramError,
  DEAD_LETTER_REASON_HEADER,
  DeduplicationCache,
  DLQ_TTL_MS,
  MAX_DELIVERIES,
  type PushEnvelope,
  pushButtonLabel,
  RETRY_DELAYS_MS,
  RETRY_HEADER,
  readRetryCount,
  renderPush,
} from "./push-delivery";

/** Отправка, достаточная push-уведомлению: сессии и update'ов у него нет. */
export type PushBotApi = Pick<Api, "sendMessage">;

/**
 * Минимальная форма входящего сообщения amqplib.
 *
 * Вынесена в собственный интерфейс, чтобы консьюмер не зависел от amqplib в
 * типах: ему нужны только тело, `messageId` и заголовки.
 *
 * Поля читаются из `properties`, как их приносит amqplib (реестр AMQP
 * `BasicProperties`), а `fields` оставлены для тестов, строивших сообщения
 * по-старому.
 */
export interface AmqpMessage {
  content: Buffer;
  fields: {
    messageId?: string;
    headers?: Record<string, unknown>;
  };
  properties?: {
    messageId?: string;
    headers?: Record<string, unknown>;
  };
}

/** `messageId` сообщения, независимо от того, где его положил поставщик. */
export function messageIdOf(message: AmqpMessage): string | undefined {
  return message.properties?.messageId ?? message.fields.messageId;
}

/** Заголовки сообщения: реальный amqplib кладёт их в `properties`. */
export function headersOf(message: AmqpMessage): Record<string, unknown> {
  return message.properties?.headers ?? message.fields.headers ?? {};
}

/**
 * Поверхность канала, которую использует консьюмер.
 *
 * Совпадает с `ChannelWrapper` из `amqp-connection-manager` в используемой
 * части и позволяет подменить её в тестах: политика доставки проверяется на
 * границе `sendMessage`/`ack`/`nack` без брокера.
 */
export interface RawChannel {
  sendToQueue(
    queue: string,
    content: Buffer | string | unknown,
    options?: Record<string, unknown>,
  ): Promise<boolean>;
  consume(
    queue: string,
    onMessage: (message: AmqpMessage) => void,
    options?: { prefetch?: number },
  ): Promise<unknown>;
  ack(message: AmqpMessage, allUpTo?: boolean): void;
  nack(message: AmqpMessage, allUpTo?: boolean, requeue?: boolean): void;
  close(): Promise<void>;
  on(event: "error", listener: (error: Error) => void): unknown;
}

/** Соединение, создаваемое фабрикой: канал и закрытие. */
export interface RawConnection {
  createChannel(options: {
    name?: string;
    setup?: (channel: Channel) => Promise<void>;
  }): ChannelWrapper;
  close(): Promise<void>;
  on(event: string, listener: (error: Error) => void): unknown;
}

export interface PushConsumerOptions {
  url: string;
  queue: string;
  prefetch: number;
  webAppUrl: string;
  api: PushBotApi;
  /** Подменяется в тестах: фабрика соединения с брокером. */
  createConnection?: (
    url: string,
    onError: (error: Error) => void,
  ) => RawConnection;
}

export interface QueueNames {
  main: string;
  dlq: string;
  /** По очереди на задержку: у каждой фиксированный TTL. */
  retry: string[];
  /**
   * Пауза, заданная самим Telegram при 429: TTL задаётся на сообщении, потому
   * что `retry_after` не укладывается в фиксированную лестницу 1/2/4/8/16 с.
   */
  rateLimit: string;
}

/**
 * Имена очередей транспорта (ADR-004:113).
 *
 * DLQ и очереди повторов выводятся из имени основной очереди, чтобы смена
 * `RABBITMQ_QUEUE_NOTIFICATIONS` не оставила бот смотреть в другую очередь,
 * куда API не публикует.
 */
export function resolveQueueNames(queue: string): QueueNames {
  return {
    main: queue,
    dlq: `${queue}.dlq`,
    retry: RETRY_DELAYS_MS.map((_, index) => `${queue}.retry.${index + 1}`),
    rateLimit: `${queue}.rate-limit`,
  };
}

/**
 * Консьюмер очереди push-уведомлений (ADR-004:113-119).
 *
 * Продюсер в `apps/api` очередь не читает, поэтому бот — единственный её
 * потребитель. Обработка одного сообщения:
 *
 * 1. дедупликация по `messageId` (транспорт at-least-once: подтверждение
 *    могло потеряться, и сообщение вернётся повторно);
 * 2. разбор конверта и рендер текста через общий с `in-app` рендер;
 * 3. `sendMessage`;
 * 4. `ack` при успехе; при временной ошибке — копия в очередь повтора
 *    соответствующей задержки и `ack` оригинала; при невосстановимой ошибке
 *    или исчерпании попыток — публикация в DLQ с подтверждением и `ack`
 *    оригинала.
 *
 * Повтор публикуется **до** `ack` оригинала, поэтому падение между двумя
 * действиями не теряет уведомление: в худшем случае оно придёт дважды, а
 * дедупликация это погасит.
 */
export class PushConsumer {
  private readonly names: QueueNames;
  private readonly dedupe = new DeduplicationCache();
  private readonly createConnection: (
    url: string,
    onError: (error: Error) => void,
  ) => RawConnection;

  private connection: RawConnection | undefined;
  private channel: ChannelWrapper | undefined;
  private raw: RawChannel | undefined;
  private stopped = false;

  constructor(private readonly options: PushConsumerOptions) {
    this.names = resolveQueueNames(options.queue);
    this.createConnection =
      options.createConnection ??
      ((url, onError) => {
        const connection = connect([url], {
          reconnectTimeInSeconds: 5,
          heartbeatIntervalInSeconds: 30,
        });
        connection.on("error", onError);
        return connection as unknown as RawConnection;
      });
  }

  /**
   * Объявляет очереди и начинает потребление.
   *
   * `start` не ждёт соединения с брокером: недоступный RabbitMQ не должен
   * мешать боту принимать команды (ADR-004:140). `ChannelWrapper` хранит
   * подписку и поднимает её сам, когда брокер вернётся; `setup` с объявлением
   * очередей выполняется при каждом подключении и всегда **до**
   * переустановки потребителей.
   */
  async start(): Promise<void> {
    this.connection = this.createConnection(this.options.url, (error) => {
      console.error(
        `[telegram-bot] RabbitMQ connection error: ${error.message}`,
      );
    });

    this.channel = this.connection.createChannel({
      name: "telegram-push-consumer",
      setup: async (channel: Channel) => {
        // TTL в DLQ вместо крона: сообщение само уходит по истечении семи
        // дней, и для этого не нужен отдельный потребитель, который забирал бы
        // сообщения у оператора (ADR-004:117).
        await channel.assertQueue(this.names.dlq, {
          durable: true,
          messageTtl: DLQ_TTL_MS,
        });

        // Основную очередь объявляет и продюсер в `apps/api`, поэтому её
        // аргументы обязаны совпадать до последнего: брокер отвечает 406 на
        // любое расхождение, и объявивший вторым перестаёт работать навсегда.
        // Никаких `x-dead-letter-*` здесь быть не может — уход в DLQ делает
        // сам консьюмер публикацией с подтверждением (см. `deadLetter`).
        await channel.assertQueue(this.names.main, { durable: true });

        for (const [index, retryQueue] of this.names.retry.entries()) {
          await channel.assertQueue(retryQueue, {
            durable: true,
            messageTtl: RETRY_DELAYS_MS[index],
            deadLetterExchange: "",
            deadLetterRoutingKey: this.names.main,
          });
        }

        // Без `messageTtl` на очереди: задержка приходит от Telegram в
        // заголовке `retry_after` и может быть любой. Очередь одна на все
        // такие паузы — сообщения выходят в порядке TTL, поэтому длинная
        // пауза задерживает и более короткие за ней; для 429 это приемлемо,
        // трафик в неё и так идёт только под rate limit.
        await channel.assertQueue(this.names.rateLimit, {
          durable: true,
          deadLetterExchange: "",
          deadLetterRoutingKey: this.names.main,
        });
      },
    });
    this.channel.on("error", (error: Error) => {
      console.error(`[telegram-bot] RabbitMQ channel error: ${error.message}`);
    });
    this.raw = this.channel as unknown as RawChannel;

    await this.raw.consume(
      this.names.main,
      (message) => {
        void this.handle(message);
      },
      { prefetch: this.options.prefetch },
    );

    console.error(
      `[telegram-bot] push consumer started on "${this.names.main}" (dlq "${this.names.dlq}")`,
    );
  }

  /**
   * Обрабатывает одно сообщение очереди.
   *
   * Отдельный метод, а не только callback в `consume`, чтобы политика
   * доставки (повтор, DLQ, дедупликация) проверялась без брокера.
   */
  async handle(message: AmqpMessage): Promise<void> {
    const channel = this.requireChannel();
    const retryCount = readRetryCount(headersOf(message));
    const messageId = messageIdOf(message);

    if (messageId !== undefined && !this.dedupe.begin(messageId)) {
      channel.ack(message);
      return;
    }

    let delivered = false;
    try {
      let envelope: PushEnvelope;
      try {
        envelope = parseEnvelope(message);
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        console.error(`[telegram-bot] push message rejected: ${reason}`);
        await this.deadLetter(message, `invalid envelope: ${reason}`);
        return;
      }

      const rendered = renderPush(envelope, this.options.webAppUrl);
      const keyboard =
        rendered.actionUrl === undefined
          ? undefined
          : new InlineKeyboard().url(
              pushButtonLabel(rendered.locale),
              rendered.actionUrl,
            );

      await this.options.api.sendMessage(envelope.chatId, rendered.text, {
        // Превью ссылки в уведомлении не нужно: текст сам содержит время и
        // ссылку, а превью ведёт получателя на страницу вместо прочтения.
        link_preview_options: { is_disabled: true },
        ...(keyboard === undefined ? {} : { reply_markup: keyboard }),
      });

      delivered = true;
      channel.ack(message);
    } catch (err) {
      const failure = classifyTelegramError(err);
      console.error(
        `[telegram-bot] push delivery failed (${failure.kind}): ${failure.description}`,
      );

      const nextRetry = retryCount + 1;
      if (failure.kind === "permanent" || nextRetry >= MAX_DELIVERIES) {
        await this.deadLetter(message, failure.description);
        return;
      }

      await this.retry(message, nextRetry, failure.retryAfterMs);
    } finally {
      // Отметка о доставке — только после `sendMessage`: повтор несёт тот же
      // `messageId`, и предварительная отметка погасила бы его навсегда.
      if (messageId !== undefined) {
        if (delivered) {
          this.dedupe.complete(messageId);
        } else {
          this.dedupe.release(messageId);
        }
      }
    }
  }

  /**
   * Планирует повтор: копия уходит в очередь с TTL, равным задержке, и
   * умирает в основной очереди по dead-letter routing.
   *
   * Задержка — это максимум из ступени лестницы и `retry_after` Telegram:
   * повтор раньше указанного ботом срока только гарантирует ещё один 429 и
   * сжигает попытку впустую.
   */
  private async retry(
    message: AmqpMessage,
    nextRetry: number,
    retryAfterMs?: number,
  ): Promise<void> {
    const channel = this.requireChannel();
    const tierDelayMs = RETRY_DELAYS_MS[nextRetry - 1];
    const respectRateLimit =
      retryAfterMs !== undefined && retryAfterMs > tierDelayMs;
    const retryQueue = respectRateLimit
      ? this.names.rateLimit
      : this.names.retry[nextRetry - 1];

    try {
      await channel.sendToQueue(retryQueue, message.content, {
        persistent: true,
        ...(messageIdOf(message) === undefined
          ? {}
          : { messageId: messageIdOf(message) }),
        ...(respectRateLimit && retryAfterMs !== undefined
          ? { expiration: retryAfterMs }
          : {}),
        headers: {
          ...headersOf(message),
          // Счётчик повторов живёт в заголовке: тело не трогается, поэтому
          // конверт остаётся байт-в-байт тем, что опубликовал API.
          [RETRY_HEADER]: nextRetry,
        },
      });
      channel.ack(message);
    } catch (err) {
      // Копию положить не удалось — возвращаем оригинал в очередь, иначе
      // уведомление потерялось бы вместе с неудачей повторной публикации.
      const reason = err instanceof Error ? err.message : String(err);
      console.error(
        `[telegram-bot] retry republish failed, requeueing original: ${reason}`,
      );
      channel.nack(message, false, true);
    }
  }

  /**
   * Уводит сообщение в DLQ.
   *
   * Публикация выполняется консьюмером, а не брокером через
   * `x-dead-letter-exchange`, по трём причинам:
   *
   * 1. причина ухода в DLQ задаётся заголовком, который `nack` установить
   *    не может — брокер переносит в DLQ исходные свойства сообщения;
   * 2. публикация подтверждается брокером, поэтому `ack` оригинала означает
   *    «сообщение точно лежит в DLQ», а не «брокер куда-то его переложит»;
   * 3. основная очередь объявляется ещё и продюсером, и любой аргумент в
   *    ней превращается в 406 при втором объявлении.
   *
   * Если публикация не удалась, оригинал возвращается в очередь: терять
   * уведомление из-за недоступной DLQ нельзя.
   */
  private async deadLetter(
    message: AmqpMessage,
    reason: string,
  ): Promise<void> {
    const channel = this.requireChannel();
    try {
      await channel.sendToQueue(this.names.dlq, message.content, {
        persistent: true,
        ...(messageIdOf(message) === undefined
          ? {}
          : { messageId: messageIdOf(message) }),
        headers: {
          ...headersOf(message),
          [DEAD_LETTER_REASON_HEADER]: reason,
        },
      });
      channel.ack(message);
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      console.error(
        `[telegram-bot] DLQ publish failed, requeueing original: ${detail}`,
      );
      channel.nack(message, false, true);
    }
  }

  /** Останавливает потребление и закрывает канал и соединение. */
  async stop(): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;

    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = undefined;
    this.connection = undefined;
    this.raw = undefined;
  }

  /**
   * Канал для обработки сообщений.
   *
   * `handle` публичный и вызывается только после `start`, поэтому
   * отсутствие канала — ошибка порядка вызовов, а не состояние гонки.
   */
  private requireChannel(): RawChannel {
    if (this.raw === undefined) {
      throw new Error("PushConsumer.handle called before start()");
    }
    return this.raw;
  }
}

/**
 * Разбирает тело сообщения в конверт.
 *
 * Обязательны адрес, локаль и таймзона: без адреса сообщение некуда
 * доставлять, а время рендерится в зоне читателя (ADR-002:55). Валидация
 * самого события — в `renderPush`, тем же словарём, что и у продюсера.
 */
export function parseEnvelope(message: AmqpMessage): PushEnvelope {
  const parsed = JSON.parse(message.content.toString("utf8")) as {
    event?: unknown;
    chatId?: unknown;
    locale?: unknown;
    timeZone?: unknown;
    actionUrl?: unknown;
  };

  if (typeof parsed.chatId !== "string" || parsed.chatId === "") {
    throw new Error("chatId is required");
  }
  if (typeof parsed.locale !== "string" || parsed.locale === "") {
    throw new Error("locale is required");
  }
  if (typeof parsed.timeZone !== "string" || parsed.timeZone === "") {
    throw new Error("timeZone is required");
  }
  if (parsed.event === undefined || parsed.event === null) {
    throw new Error("event is required");
  }
  if (parsed.actionUrl !== undefined && typeof parsed.actionUrl !== "string") {
    throw new Error("actionUrl must be a string");
  }

  return {
    event: parsed.event,
    chatId: parsed.chatId,
    locale: parsed.locale,
    timeZone: parsed.timeZone,
    ...(parsed.actionUrl === undefined ? {} : { actionUrl: parsed.actionUrl }),
  };
}
