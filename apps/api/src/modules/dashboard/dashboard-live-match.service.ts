import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import type {
  LiveMatchStatusResponseDto,
  LiveMatchToggleDto,
} from "@packages/dto";
import { RedisService } from "../../redis/redis.service";
import {
  LiveMatchPostCommitError,
  SessionsService,
} from "../sessions/sessions.service";

const QUEUE_TTL_SECONDS = 600; // 10 минут на весь ключ очереди
const MATCH_EXPIRATION_MS = 5 * 60 * 1000; // 5 минут на активность заявки пользователя

/**
 * Lua-скрипт для атомарного извлечения партнёра или постановки текущего пользователя в очередь.
 *
 * KEYS[1]: queueKey (ZSET очереди live_queue:<spec>:<level>)
 * ARGV[1]: userId
 * ARGV[2]: nowScore (timestamp в миллисекундах)
 * ARGV[3]: ttlSeconds (время жизни ключа очереди)
 * ARGV[4]: cutoff (timestamp в миллисекундах)
 *
 * Если в очереди есть подходящий напарник (отличный от userId) — извлекает его
 * из очереди и удаляет текущего пользователя, возвращая partnerId.
 * Если напарник не найден — добавляет userId в очередь и обновляет TTL, возвращая nil.
 */
export const MATCH_OR_ENQUEUE_LUA = `
local queueKey = KEYS[1]
local userId = ARGV[1]
local nowScore = tonumber(ARGV[2])
local ttlSeconds = tonumber(ARGV[3])
local cutoff = tonumber(ARGV[4])

redis.call('ZREMRANGEBYSCORE', queueKey, '-inf', cutoff)
local candidates = redis.call('ZRANGE', queueKey, 0, 10)
for i = 1, #candidates do
  if candidates[i] ~= userId then
    local partner = candidates[i]
    redis.call('ZREM', queueKey, partner)
    redis.call('ZREM', queueKey, userId)
    return partner
  end
end

redis.call('ZADD', queueKey, nowScore, userId)
redis.call('EXPIRE', queueKey, ttlSeconds)
return nil
`;

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
   * Выбор партнёра и постановка в очередь выполняются атомарно через Lua EVAL.
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

    // 3. Атомарно извлекаем напарника или добавляем себя в очередь через Lua-скрипт
    const partnerId = await this.redisService.eval<string | null>(
      MATCH_OR_ENQUEUE_LUA,
      1,
      queueKey,
      userId,
      now,
      QUEUE_TTL_SECONDS,
      cutoff,
    );

    if (partnerId) {
      this.logger.log(
        `Live match found: ${userId} <-> ${partnerId} (${spec}/${level})`,
      );

      let sessionId: string | null = null;
      let inviteToken: string | null = null;

      try {
        const sessionResult = await this.sessionsService.createLiveMatchSession(
          userId,
          partnerId,
        );
        sessionId = sessionResult.sessionId;
        inviteToken = sessionResult.inviteToken;
      } catch (error) {
        if (error instanceof LiveMatchPostCommitError) {
          sessionId = error.sessionId;
          inviteToken = error.inviteToken;
          this.logger.warn(
            `Live match session ${sessionId} committed to Postgres, but post-commit operations failed: ${error.message}`,
          );
        } else {
          // Pre-commit ошибка: сессия НЕ создана в Postgres.
          // Только в этом случае возвращаем участников в очередь!
          this.logger.error(
            `Failed to create live session before commit: ${(error as Error).message}`,
          );
          await this.redisService.zadd(queueKey, now, partnerId);
          await this.redisService.zadd(queueKey, now, userId);
          await this.redisService.expire(queueKey, QUEUE_TTL_SECONDS);

          return {
            status: "SEARCHING",
            estimatedWaitSeconds: 45,
          };
        }
      }

      // Post-commit: сессия успешно сохранена в Postgres со статусом ACTIVE.
      // Не удаляем сессию и не возвращаем участников в очередь (исключает создание дубликатов).
      // Идемпотентно восстанавливаем Redis mirror и уведомление партнёра с retry.
      if (sessionId) {
        await this.ensurePostCommitIntegrity(
          sessionId,
          userId,
          partnerId,
          inviteToken,
        );

        return {
          status: "MATCHED",
          sessionId,
        };
      }
    }

    // 4. Если напарник не найден — пользователь уже добавлен в очередь внутри Lua-скрипта
    return {
      status: "SEARCHING",
      estimatedWaitSeconds: 45,
    };
  }

  /**
   * Идемпотентно восстанавливает Redis-зеркало и отправляет уведомление партнёру с повторными попытками (retry).
   */
  private async ensurePostCommitIntegrity(
    sessionId: string,
    userId: string,
    partnerId: string,
    inviteToken: string | null,
  ): Promise<void> {
    const MAX_RETRIES = 3;

    // 1. Идемпотентный retry прогрева Redis-зеркала
    if (inviteToken) {
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          await this.sessionsService.warmLiveMatchMirror(
            sessionId,
            userId,
            partnerId,
            inviteToken,
          );
          break;
        } catch (mirrorError) {
          this.logger.warn(
            `Retry ${attempt}/${MAX_RETRIES} to warm mirror for session ${sessionId} failed: ${(mirrorError as Error).message}`,
          );
        }
      }
    }

    // 2. Идемпотентный retry публикации уведомления партнёру
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        await this.redisService.publish(
          `live_match:notify:${partnerId}`,
          JSON.stringify({ sessionId }),
        );
        break;
      } catch (pubError) {
        this.logger.warn(
          `Retry ${attempt}/${MAX_RETRIES} to notify partner ${partnerId} for session ${sessionId} failed: ${(pubError as Error).message}`,
        );
      }
    }
  }
}
