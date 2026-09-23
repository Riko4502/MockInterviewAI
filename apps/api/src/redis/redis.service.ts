import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

import { MetricsService } from "../common/metrics/metrics.service";

/**
 * Сервис доступа к Redis через ioredis.
 *
 * Зарегистрирован в глобальном модуле `RedisModule` — доступен через DI
 * без импорта модуля. Конфигурация берётся из секции `redis`
 * (`redis.host`, `redis.port`, `redis.password`).
 *
 * Предоставляет операции для:
 * - key-value (`set`, `get`, `delete`, `expire`);
 * - distributed lock (`setNx`);
 * - hash (`hset`, `hget`, `hdel`);
 * - SCAN (`scanKeys`);
 * - Pub/Sub (`publish`);
 * - Redis Streams (`xadd`);
 * - health-check (`ping`).
 *
 * Все методы пробрасывают ошибки ioredis наверх для компенсации
 * на уровне вызывающего кода (§48 SPEC.md).
 *
 * Инструментируется метриками соединения: gauge статуса (`ready`/`error`/
 * `close`/`reconnecting`) и счётчик ошибок клиента по типу (SPEC.md, §8).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  /**
   * @param configService - Конфигурация приложения (секция `redis`).
   */
  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {}

  /** Устанавливает соединение с Redis при инициализации модуля. */
  async onModuleInit(): Promise<void> {
    const host = this.configService.get<string>("redis.host") ?? "localhost";

    const port = this.configService.get<number>("redis.port") ?? 6379;

    const password = this.configService.get<string>("redis.password") ?? "";

    this.client = new Redis({
      host,
      port,
      password,
      lazyConnect: true,
      retryStrategy: (times: number) =>
        times > 5 ? null : Math.min(times * 100, 500),
      maxRetriesPerRequest: 1,
    });

    this.client.on("ready", () => {
      this.metricsService.setRedisStatus("ready");
      this.logger.log("Redis connection established");
    });
    this.client.on("error", (error: Error) => {
      this.metricsService.setRedisStatus("error");
      this.metricsService.incRedisError(this.classifyRedisError(error));
      this.logger.error("Redis connection error", error.message);
    });
    this.client.on("close", () => {
      this.metricsService.setRedisStatus("close");
    });
    this.client.on("reconnecting", () => {
      this.metricsService.setRedisStatus("reconnecting");
    });

    await this.client.connect();
    this.logger.log("Redis connection established");
  }

  private classifyRedisError(error: Error): string {
    const message = error.message;
    if (message.includes("NOAUTH")) return "NOAUTH";
    if (message.includes("ECONNREFUSED")) return "ECONNREFUSED";
    if (message.includes("ECONNRESET")) return "ECONNRESET";
    if (message.includes("ETIMEDOUT")) return "ETIMEDOUT";
    return "other";
  }

  /** Закрывает соединение с Redis при завершении работы модуля. */
  async onModuleDestroy(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }

    this.logger.log("Redis connection closed");
  }

  /**
   * Устанавливает ключ со значением и опциональным TTL.
   *
   * @param key - Имя ключа.
   * @param value - Значение.
   * @param ttlSeconds - Время жизни в секундах (опционально).
   * @throws {Error} При ошибке Redis.
   */
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds !== undefined) {
      await this.client.set(key, value, "EX", ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  /**
   * Устанавливает ключ только если он не существует (NX)
   * с временем жизни (Distributed Lock).
   *
   * @param key - Имя ключа.
   * @param value - Значение.
   * @param ttlSeconds - Время жизни в секундах.
   * @returns `true`, если ключ был успешно установлен,
   * иначе `false`.
   */
  async setNx(
    key: string,
    value: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    const result = await this.client.set(key, value, "EX", ttlSeconds, "NX");

    return result === "OK";
  }

  /**
   * Получает значение по ключу.
   *
   * @param key - Имя ключа.
   * @returns Значение или `null`, если ключ не существует.
   * @throws {Error} При ошибке Redis.
   */
  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  /**
   * Получает значения по массиву ключей (MGET).
   *
   * @param keys - Массив имен ключей.
   * @returns Массив значений (строка или `null` для отсутствующих ключей).
   * @throws {Error} При ошибке Redis.
   */
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (keys.length === 0) {
      return [];
    }
    return this.client.mget(...keys);
  }

  /**
   * Атомарно возвращает и удаляет ключ (GETDEL).
   *
   * @param key - Имя ключа.
   * @returns Значение или `null`, если ключ не существовал.
   * @throws {Error} При ошибке Redis.
   */
  async getdel(key: string): Promise<string | null> {
    return this.client.getdel(key);
  }

  /**
   * Проверяет существование ключа (EXISTS).
   *
   * @param key - Имя ключа.
   * @returns `true`, если ключ существует, иначе `false`.
   * @throws {Error} При ошибке Redis.
   */
  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  /**
   * Удаляет ключ.
   *
   * @param key - Имя ключа.
   * @throws {Error} При ошибке Redis.
   */
  async delete(key: string): Promise<void> {
    await this.client.del(key);
  }

  /**
   * Устанавливает время жизни ключа.
   *
   * @param key - Имя ключа.
   * @param ttlSeconds - Время жизни в секундах.
   * @throws {Error} При ошибке Redis.
   */
  async expire(key: string, ttlSeconds: number): Promise<void> {
    await this.client.expire(key, ttlSeconds);
  }

  /**
   * Устанавливает поле в хеше (HSET) и, если задан TTL,
   * продлевает время жизни самого ключа (EXPIRE).
   *
   * Используется для Redis-зеркала интервью-сессий
   * (`session:{id}:members`).
   *
   * @param key - Имя ключа-хеша.
   * @param field - Поле хеша (обычно `userId`).
   * @param value - Значение поля (обычно роль).
   * @param ttlSeconds - Время жизни ключа в секундах (опционально).
   * @throws {Error} При ошибке Redis.
   */
  async hset(
    key: string,
    field: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<void> {
    await this.client.hset(key, field, value);

    if (ttlSeconds !== undefined) {
      await this.client.expire(key, ttlSeconds);
    }
  }

  /**
   * Получает значение поля из хеша (HGET).
   *
   * @param key - Имя ключа-хеша.
   * @param field - Поле хеша.
   * @returns Значение поля или `null`,
   * если поле/ключ не существует.
   * @throws {Error} При ошибке Redis.
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Удаляет поле из хеша (HDEL) и, если задан TTL,
   * продлевает время жизни ключа (EXPIRE).
   *
   * Используется для Redis-зеркала интервью-сессий.
   *
   * @param key - Имя ключа-хеша.
   * @param field - Поле хеша.
   * @param ttlSeconds - Время жизни ключа в секундах (опционально).
   * @throws {Error} При ошибке Redis.
   */
  async hdel(key: string, field: string, ttlSeconds?: number): Promise<void> {
    await this.client.hdel(key, field);

    if (ttlSeconds !== undefined) {
      await this.client.expire(key, ttlSeconds);
    }
  }

  /**
   * Возвращает ключи, соответствующие шаблону,
   * через SCAN-итерацию.
   *
   * Итерация выполняется через `scanStream`
   * (пагинация курсором скрыта),
   * собранные ключи возвращаются массивом.
   *
   * Гарантирует неблокирующий обход
   * по сравнению с `KEYS`.
   *
   * @param pattern - Redis-шаблон
   * (например `auth:session:*`).
   * @param count - Размер пачки SCAN (`COUNT`),
   * опционально (дефолт 100).
   * @returns Массив ключей,
   * соответствовавших шаблону.
   * @throws {Error} При ошибке Redis.
   */
  scanKeys(pattern: string, count = 100): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const stream = this.client.scanStream({
        match: pattern,
        count,
      });

      const keys: string[] = [];

      stream.on("data", (chunk: string[]) => {
        if (Array.isArray(chunk)) {
          keys.push(...chunk);
        }
      });

      stream.on("end", () => {
        resolve(keys);
      });

      stream.on("error", (error: Error) => {
        reject(error);
      });
    });
  }

  /**
   * Публикует сообщение в Redis-канал Pub/Sub.
   *
   * Используется для fire-and-forget событий,
   * которым не требуется хранение истории.
   *
   * @param channel - Имя канала.
   * @param message - Текст сообщения (JSON).
   * @throws {Error} При ошибке Redis.
   */
  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
  }

  /**
   * Добавляет событие в Redis Stream.
   *
   * Событие сохраняется в формате:
   *
   * type: <event type>
   * data: <JSON payload>
   *
   * Опционально ограничивает длину стрима через
   * `MAXLEN ~` и выставляет TTL на ключ.
   *
   * Используется producer-сервисами для realtime-событий,
   * которые затем читаются сервисом `apps/realtime`.
   *
   * @param stream - Имя Redis Stream.
   * @param type - Тип события.
   * @param data - Payload события.
   * @param maxLength - Максимальная примерная длина стрима.
   * @param ttlSeconds - TTL стрима в секундах (опционально).
   * @returns ID созданной записи Redis Stream.
   * @throws {Error} При ошибке Redis.
   */
  async xadd(
    stream: string,
    type: string,
    data: unknown,
    maxLength = 100,
    ttlSeconds?: number,
  ): Promise<string | null> {
    const id = await this.client.xadd(
      stream,
      "MAXLEN",
      "~",
      maxLength,
      "*",
      "type",
      type,
      "data",
      JSON.stringify(data),
    );

    if (ttlSeconds !== undefined) {
      await this.client.expire(stream, ttlSeconds);
    }

    return id;
  }

  /**
   * Выполняет Lua-скрипт в Redis (EVAL).
   *
   * Поддерживает обе формы вызова:
   * 1. `eval(script, keys, args)`
   * 2. `eval(script, numKeys, ...args)`
   */
  async eval<T = unknown>(
    script: string,
    keys: string[],
    args: (string | number)[],
  ): Promise<T>;
  async eval<T = unknown>(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<T>;
  async eval<T = unknown>(
    script: string,
    keysOrNumKeys: string[] | number,
    ...rest: unknown[]
  ): Promise<T> {
    if (Array.isArray(keysOrNumKeys)) {
      const keys = keysOrNumKeys;
      const args = (rest[0] as (string | number)[]) ?? [];
      return (await this.client.eval(
        script,
        keys.length,
        ...keys,
        ...args,
      )) as T;
    }
    const numKeys = keysOrNumKeys;
    const args = rest as (string | number)[];
    return (await this.client.eval(script, numKeys, ...args)) as T;
  }

  /**
   * Проверяет доступность Redis (PING/PONG).
   *
   * @returns Ответ сервера (`"PONG"`).
   * @throws {Error} При ошибке Redis.
   */
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
