import { Injectable, Logger } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class DashboardCacheService {
  private readonly logger = new Logger(DashboardCacheService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Получает значение из кэша Redis или вычисляет его через fallback и сохраняет с заданным TTL.
   */
  async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    fallback: () => Promise<T>,
  ): Promise<T> {
    try {
      const cached = await this.redisService.get(key);
      if (cached) {
        return JSON.parse(cached) as T;
      }
    } catch (error) {
      this.logger.warn(
        `Redis cache get failed for key "${key}": ${(error as Error).message}`,
      );
    }

    const fresh = await fallback();

    try {
      await this.redisService.set(key, JSON.stringify(fresh), ttlSeconds);
    } catch (error) {
      this.logger.warn(
        `Redis cache set failed for key "${key}": ${(error as Error).message}`,
      );
    }

    return fresh;
  }

  /**
   * Удаляет конкретный ключ из кэша.
   */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redisService.delete(key);
    } catch (error) {
      this.logger.warn(
        `Redis cache delete failed for key "${key}": ${(error as Error).message}`,
      );
    }
  }

  /**
   * Удаляет все ключи по шаблону через SCAN (не блокирует Redis).
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await this.redisService.scanKeys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((k) => this.redisService.delete(k)));
      }
    } catch (error) {
      this.logger.warn(
        `Redis cache pattern invalidation failed for "${pattern}": ${(error as Error).message}`,
      );
    }
  }
}
