import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type {
  LiveMatchStatusResponseDto,
  LiveMatchToggleDto,
} from "@packages/dto";
import { RedisService } from "../../redis/redis.service";
import { SessionsService } from "../sessions/sessions.service";

const QUEUE_TTL_SECONDS = 600; // 10 минут на весь ключ очереди
const MATCH_EXPIRATION_MS = 5 * 60 * 1000; // 5 минут на активность заявки пользователя

@Injectable()
export class DashboardLiveMatchService {
  private readonly logger = new Logger(DashboardLiveMatchService.name);

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Включение / отключение режима живого поиска напарника в реальном времени.
   * Очередь построена на Redis ZSET (score = timestamp) для автоматического
   * удаления зависших офлайн-пользователей (TASK-BACK-43).
   * При нахождении пары создается сессия с полным прогревом Redis-зеркала (TASK-BACK-42).
   */
  async toggleLiveMatch(
    userId: string,
    dto: LiveMatchToggleDto,
  ): Promise<LiveMatchStatusResponseDto> {
    if (!dto.specialization || !dto.level) {
      throw new BadRequestException(
        "Специализация и уровень обязательны для участия в поиске напарника",
      );
    }

    const spec = dto.specialization;
    const level = dto.level;
    const queueKey = `live_queue:${spec}:${level}`;

    const now = Date.now();
    const cutoff = now - MATCH_EXPIRATION_MS;

    // 1. Очищаем устаревшие заявки (старше 5 минут)
    try {
      await this.redisService.zremrangebyscore(queueKey, "-inf", cutoff);
    } catch (err) {
      this.logger.warn(
        `Failed to prune expired live queue entries for ${queueKey}: ${(err as Error).message}`,
      );
    }

    // 2. Если пользователь отключает поиск — убираем его из очереди
    if (!dto.isSearching) {
      await this.redisService.zrem(queueKey, userId);
      return { status: "IDLE" };
    }

    // 3. Ищем наиболее давно ожидающего напарника (первые кандидаты в ZSET)
    const candidates = await this.redisService.zrange(queueKey, 0, 5);
    const partnerId = candidates.find((id) => id !== userId);

    if (partnerId) {
      // Атомарно извлекаем напарника из очереди (защита от race condition между двумя параллельными парами)
      const removed = await this.redisService.zrem(queueKey, partnerId);

      if (removed > 0) {
        this.logger.log(
          `Live match found: ${userId} <-> ${partnerId} (${spec}/${level})`,
        );

        try {
          // Создаем сессию и прогреваем Redis-зеркало через SessionsService (TASK-BACK-42)
          const { sessionId } =
            await this.sessionsService.createLiveMatchSession(
              userId,
              partnerId,
            );

          // Убираем себя из очереди, если уже были там
          await this.redisService.zrem(queueKey, userId);

          // Оповещаем второго участника через Redis Pub/Sub
          await this.redisService.publish(
            `live_match:notify:${partnerId}`,
            JSON.stringify({ sessionId }),
          );

          return {
            status: "MATCHED",
            sessionId,
          };
        } catch (error) {
          this.logger.error(
            `Failed to create live session: ${(error as Error).message}`,
          );
          // Возвращаем напарника обратно в очередь
          await this.redisService.zadd(queueKey, now, partnerId);
        }
      }
    }

    // 4. Если напарник не найден — регистрируем себя со свежим timestamp
    await this.redisService.zadd(queueKey, now, userId);
    await this.redisService.expire(queueKey, QUEUE_TTL_SECONDS);

    return {
      status: "SEARCHING",
      estimatedWaitSeconds: 45,
    };
  }
}
