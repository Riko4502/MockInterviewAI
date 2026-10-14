import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  type AmqpConnectionManager,
  type Channel,
  type ChannelWrapper,
  connect,
} from "amqp-connection-manager";

/** Имя очереди push-доставки (ADR-004:109). */
export const TELEGRAM_QUEUE = "telegram.notifications";

/**
 * Конверт сообщения очереди push-доставки (ADR-004:129, :191).
 *
 * Отличие от payload'а события намеренное: `chatId` здесь — адрес доставки,
 * который бот обязан получить, чтобы отправить сообщение, поэтому в payload
 * события он и не попадает (ADR-003:83). `locale` и `timeZone` едут вместе с
 * событием, потому что текст и время рендерятся в зоне читателя (ADR-002:55),
 * а бот держит сессию только в памяти и не ходит в БД за профилем получателя.
 */
export interface TelegramPushEnvelope {
  event: {
    type: string;
    payload: Record<string, unknown>;
  };
  chatId: string;
  locale: string;
  timeZone: string;
  actionUrl?: string;
}

/** Токен для тестовой подмены фабрики соединения. */
export const AMQP_CONNECTION_FACTORY = Symbol("AMQP_CONNECTION_FACTORY");

export type AmqpConnectionFactory = (
  url: string,
  onError: (error: Error) => void,
) => AmqpConnectionManager;

/**
 * amqp-connection-manager переподключается сам, поэтому приложение не падает
 * вместе с брокером. Обработчик `error` обязателен: без него ошибка соединения
 * всплыла бы как необработанное событие `EventEmitter` и уронила процесс.
 */
export const amqpConnectionFactory: AmqpConnectionFactory = (url, onError) => {
  const connection = connect([url], {
    reconnectTimeInSeconds: 5,
    heartbeatIntervalInSeconds: 30,
  });
  connection.on("error", onError);
  return connection;
};

/**
 * Продюсер RabbitMQ (ADR-004:128).
 *
 * В `apps/api` консьюмеров нет и не планируется: единственный потребитель
 * очереди — `apps/telegram-bot`. Публикация вызывается только из релея outbox
 * (ADR-004:131), поэтому с точки зрения транзакции отправка в Telegram — одна
 * операция вместе с записью события.
 *
 * При недоступном брокере приложение продолжает обслуживать HTTP-запросы, а
 * публикация упирается в `publishTimeout`: строка outbox остаётся `PENDING` и
 * будет опубликована позже, когда брокер оживёт (ADR-004:140, :144).
 */
@Injectable()
export class RabbitMqPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMqPublisher.name);

  private connection: AmqpConnectionManager | undefined;
  private channel: ChannelWrapper | undefined;

  constructor(
    private readonly config: ConfigService,
    @Inject(AMQP_CONNECTION_FACTORY)
    private readonly createConnection: AmqpConnectionFactory,
  ) {}

  /**
   * Публикует конверт в очередь push-доставки.
   *
   * Промис резолвится только после подтверждения брокером, поэтому строка
   * outbox не помечается доставленной «по факту вызова» (ADR-004:144).
   */
  async publish(
    envelope: TelegramPushEnvelope,
    messageId: string,
  ): Promise<void> {
    const channel = this.ensureChannel();

    await channel.sendToQueue(this.queue, JSON.stringify(envelope), {
      contentType: "application/json",
      // Идентификатор идемпотентности (ADR-004:136): транспорт at-least-once,
      // поэтому повторная публикация после таймаута — норма, а не авария.
      messageId,
      timestamp: Date.now(),
      // Сообщение переживает перезапуск брокера.
      persistent: true,
    });
  }

  private get queue(): string {
    return this.config.get<string>("rabbitmq.queue") ?? TELEGRAM_QUEUE;
  }

  private get publishTimeoutMs(): number {
    return this.config.get<number>("rabbitmq.publishTimeoutMs") ?? 5000;
  }

  /**
   * Соединение и канал создаются лениво и один раз: старт HTTP-сервера не
   * должен зависеть от доступности брокера.
   */
  private ensureChannel(): ChannelWrapper {
    if (this.channel !== undefined) {
      return this.channel;
    }

    if (this.connection === undefined) {
      const url = this.config.get<string>("rabbitmq.url") ?? "";
      if (url === "") {
        throw new Error("RABBITMQ_URL is not configured");
      }
      this.connection = this.createConnection(url, (error) =>
        this.logger.warn(`RabbitMQ connection error: ${error.message}`),
      );
    }

    const queue = this.queue;
    const channel = this.connection.createChannel({
      name: "telegram-push",
      publishTimeout: this.publishTimeoutMs,
      setup: async (channel: Channel) => {
        await channel.assertQueue(queue, { durable: true });
      },
    });
    channel.on("error", (error: Error) =>
      this.logger.warn(`RabbitMQ channel error: ${error.message}`),
    );

    this.channel = channel;
    return channel;
  }

  async onModuleDestroy(): Promise<void> {
    const channel = this.channel;
    const connection = this.connection;
    this.channel = undefined;
    this.connection = undefined;

    if (channel !== undefined) {
      await channel.close().catch(() => undefined);
    }
    if (connection !== undefined) {
      await connection.close().catch(() => undefined);
    }
  }
}
