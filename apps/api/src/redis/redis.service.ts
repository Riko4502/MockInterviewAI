import {
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Сервис доступа к Redis через ioredis.
 *
 * Зарегистрирован в глобальном модуле `RedisModule` — доступен через DI
 * без импорта модуля. Конфигурация берётся из секции `redis`
 * (`redis.host`, `redis.port`, `redis.password`).
 *
 * Предоставляет базовые операции: `set`, `get`, `delete`, `expire`, `ping`.
 * Все методы пробрасывают ошибки ioredis наверх для компенсации
 * на уровне вызывающего кода (§48 SPEC.md).
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client!: Redis;

  /**
   * @param configService - Конфигурация приложения (секция `redis`).
   */
  constructor(private readonly configService: ConfigService) {}

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

    await this.client.connect();
    this.logger.log("Redis connection established");
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
   * Устанавливает ключ только если он не существует (NX) с временем жизни (Distributed Lock).
   *
   * @param key - Имя ключа.
   * @param value - Значение.
   * @param ttlSeconds - Время жизни в секундах.
   * @returns `true`, если ключ был успешно установлен (захвачен лок), иначе `false`.
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
   * Устанавливает поле в хеше (HSET) и, если задан TTL, продлевает время жизни
   * самого ключа (EXPIRE). Используется для Redis-зеркала интервью-сессий
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
   * @returns Значение поля или `null`, если поле/ключ не существует.
   * @throws {Error} При ошибке Redis.
   */
  async hget(key: string, field: string): Promise<string | null> {
    return this.client.hget(key, field);
  }

  /**
   * Удаляет поле из хеша (HDEL) и, если задан TTL, продлевает время жизни
   * ключа (EXPIRE). Используется для Redis-зеркала интервью-сессий.
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
   * Публикует сообщение в Redis-канал Pub/Sub.
   *
   * @param channel - Имя канала.
   * @param message - Текст сообщения (JSON).
   */
  async publish(channel: string, message: string): Promise<void> {
    await this.client.publish(channel, message);
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
