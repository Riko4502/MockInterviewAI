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

    this.client = new Redis({ host, port, password, lazyConnect: false });

    await this.client.connect();
    this.logger.log("Redis connection established");
  }

  /** Закрывает соединение с Redis при завершении работы модуля. */
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
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
   * Проверяет доступность Redis (PING/PONG).
   *
   * @returns Ответ сервера (`"PONG"`).
   * @throws {Error} При ошибке Redis.
   */
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
