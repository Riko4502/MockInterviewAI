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

const USER_QUEUE_PREFIX = "live_user_queue:";
const USER_MATCHED_PREFIX = "live_user_matched:";

@Injectable()
export class DashboardLiveMatchService {
  private readonly logger = new Logger(DashboardLiveMatchService.name);

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Получение текущего статуса участия пользователя в живом поиске напарника.
   * Восстанавливает статус SEARCHING / MATCHED / IDLE с параметрами очереди при обновлении страницы.
   */
  async getLiveMatchStatus(
    userId: string,
  ): Promise<LiveMatchStatusResponseDto> {
    // 1. Проверяем, не сматчился ли пользователь недавно
    const matchedDataStr = await this.redisService.get(
      `${USER_MATCHED_PREFIX}${userId}`,
    );
    if (matchedDataStr) {
      try {
        const matchedData = JSON.parse(matchedDataStr);
        await this.redisService.delete(`${USER_MATCHED_PREFIX}${userId}`);
        return {
          status: "MATCHED",
          sessionId: matchedData.sessionId,
          specialization: matchedData.specialization,
          level: matchedData.level,
        };
      } catch {
        await this.redisService.delete(`${USER_MATCHED_PREFIX}${userId}`);
      }
    }

    // 2. Проверяем активную очередь пользователя
    const queueDataStr = await this.redisService.get(
      `${USER_QUEUE_PREFIX}${userId}`,
    );
    if (!queueDataStr) {
      return { status: "IDLE" };
    }

    try {
      const queueData = JSON.parse(queueDataStr) as {
        specialization: LiveMatchToggleDto["specialization"];
        level: LiveMatchToggleDto["level"];
        enqueuedAt: number;
      };
      const now = Date.now();
      if (now - queueData.enqueuedAt > MATCH_EXPIRATION_MS) {
        await this.redisService.delete(`${USER_QUEUE_PREFIX}${userId}`);
        return { status: "IDLE" };
      }

      const queueKey = `live_queue:${queueData.specialization}:${queueData.level}`;
      const score = await this.redisService.zscore(queueKey, userId);
      if (score === null || score === undefined) {
        await this.redisService.delete(`${USER_QUEUE_PREFIX}${userId}`);
        return { status: "IDLE" };
      }

      return {
        status: "SEARCHING",
        specialization: queueData.specialization,
        level: queueData.level,
        estimatedWaitSeconds: 45,
      };
    } catch {
      await this.redisService.delete(`${USER_QUEUE_PREFIX}${userId}`);
      return { status: "IDLE" };
    }
  }

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
    let spec = dto.specialization;
    let level = dto.level;

    if (!spec || !level) {
      const userQueueStr = await this.redisService.get(
        `${USER_QUEUE_PREFIX}${userId}`,
      );
      if (userQueueStr) {
        try {
          const parsed = JSON.parse(userQueueStr);
          spec = spec ?? parsed.specialization;
          level = level ?? parsed.level;
        } catch {
          // ignore parsing error
        }
      }
    }

    // Если пользователь отключает поиск — убираем его из очереди и удаляем индекс
    if (!dto.isSearching) {
      if (spec && level) {
        const queueKey = `live_queue:${spec}:${level}`;
        await this.redisService.zrem(queueKey, userId);
      }
      await this.redisService.delete(`${USER_QUEUE_PREFIX}${userId}`);
      await this.redisService.delete(`${USER_MATCHED_PREFIX}${userId}`);
      return { status: "IDLE" };
    }

    if (!spec || !level) {
      throw new BadRequestException(
        "Специализация и уровень обязательны для участия в поиске напарника",
      );
    }

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

    // 2. Атомарно извлекаем напарника или добавляем себя в очередь через Lua-скрипт
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
          await this.redisService.set(
            `${USER_QUEUE_PREFIX}${userId}`,
            JSON.stringify({ specialization: spec, level, enqueuedAt: now }),
            Math.ceil(MATCH_EXPIRATION_MS / 1000),
          );

          return {
            status: "SEARCHING",
            specialization: spec,
            level,
            estimatedWaitSeconds: 45,
          };
        }
      }

      // Post-commit: сессия успешно сохранена в Postgres со статусом ACTIVE.
      // Не удаляем сессию и не возвращаем участников в очередь (исключает создание дубликатов).
      // Идемпотентно восстанавливаем Redis mirror и уведомление партнёра с retry.
      if (sessionId) {
        await Promise.all([
          this.redisService.delete(`${USER_QUEUE_PREFIX}${userId}`),
          this.redisService.delete(`${USER_QUEUE_PREFIX}${partnerId}`),
          this.redisService.set(
            `${USER_MATCHED_PREFIX}${partnerId}`,
            JSON.stringify({ sessionId, specialization: spec, level }),
            60,
          ),
        ]);

        await this.ensurePostCommitIntegrity(
          sessionId,
          userId,
          partnerId,
          inviteToken,
        );

        return {
          status: "MATCHED",
          sessionId,
          specialization: spec,
          level,
        };
      }
    }

    // 3. Если напарник не найден — пользователь добавлен в очередь внутри Lua-скрипта
    await this.redisService.set(
      `${USER_QUEUE_PREFIX}${userId}`,
      JSON.stringify({ specialization: spec, level, enqueuedAt: now }),
      Math.ceil(MATCH_EXPIRATION_MS / 1000),
    );

    return {
      status: "SEARCHING",
      specialization: spec,
      level,
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
