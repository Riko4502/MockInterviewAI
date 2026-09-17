import { Injectable, Logger, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { RedisService } from "../../../redis/redis.service";
import { REDIS_SESSION_PREFIX } from "../auth.constants";
import { getRefreshTokenTtlSeconds } from "./refresh-token-ttl";

/** Payload authentication session в Redis (§16 SPEC.md). */
export interface AuthSession {
  userId: string;
  refreshTokenHash: string;
  tokenFamilyId: string;
  createdAt: string;
  lastUsedAt: string;
  /** Поколение авторизации для предотвращения race conditions (§CWE-362). */
  generation?: number;
}

/**
 * Сервис управления authentication sessions в Redis (§13–18, §30–32, §39 SPEC.md).
 *
 * Отвечает за: создание/чтение/обновление/удаление session,
 * rotation refresh token с replay detection, привязку TTL к `JWT_REFRESH_EXPIRATION`.
 */
/**
 * Lua-скрипт для атомарной проверки generation fence, сохранения сессии и индексации в ZSET (§CWE-362).
 * KEYS[1]: auth:user:{userId}:min_generation
 * KEYS[2]: auth:session:{sessionId}
 * KEYS[3]: auth:user:{userId}:sessions
 * ARGV[1]: generation (number | "")
 * ARGV[2]: session JSON
 * ARGV[3]: ttlSeconds (number)
 * ARGV[4]: sessionId (string)
 * ARGV[5]: nowMs (number)
 *
 * Возвращает 1 в случае успеха, -1 если generation устарел.
 */
export const CREATE_SESSION_LUA = `
local min_gen_key = KEYS[1]
local session_key = KEYS[2]
local user_sessions_key = KEYS[3]
local generation = tonumber(ARGV[1])
local session_json = ARGV[2]
local ttl = tonumber(ARGV[3])
local session_id = ARGV[4]
local now_ms = tonumber(ARGV[5])

if generation ~= nil then
    local min_gen_val = redis.call('get', min_gen_key)
    if min_gen_val then
        local min_gen = tonumber(min_gen_val)
        if min_gen and generation < min_gen then
            return -1
        end
    end
end

if ttl and ttl > 0 then
    redis.call('set', session_key, session_json, 'EX', ttl)
    if user_sessions_key and session_id and now_ms then
        local expire_at_ms = now_ms + (ttl * 1000)
        redis.call('zremrangebyscore', user_sessions_key, '-inf', '(' .. now_ms)
        redis.call('zadd', user_sessions_key, expire_at_ms, session_id)
        redis.call('expire', user_sessions_key, ttl)
    end
else
    redis.call('set', session_key, session_json)
    if user_sessions_key and session_id then
        redis.call('zadd', user_sessions_key, '+inf', session_id)
    end
end

return 1
`;

/**
 * Lua-скрипт для получения активных сессий пользователя из ZSET с предварительной очисткой устаревших.
 * KEYS[1]: auth:user:{userId}:sessions
 * ARGV[1]: nowMs (number)
 *
 * Возвращает массив ID активных сессий.
 */
export const GET_USER_ACTIVE_SESSIONS_LUA = `
local user_sessions_key = KEYS[1]
local now_ms = tonumber(ARGV[1])

if now_ms then
    redis.call('zremrangebyscore', user_sessions_key, '-inf', '(' .. now_ms)
end

return redis.call('zrange', user_sessions_key, 0, -1)
`;

/**
 * Lua-скрипт для атомарного монотонного обновления generation fence (§CWE-362).
 * KEYS[1]: auth:user:{userId}:min_generation
 * ARGV[1]: targetMinGen (number)
 * ARGV[2]: ttlSeconds (number)
 *
 * Устанавливает max(currentMinGen, targetMinGen) и предотвращает понижение fence.
 */
export const UPDATE_MIN_GEN_LUA = `
local min_gen_key = KEYS[1]
local target_min_gen = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current_val = redis.call('get', min_gen_key)
local current_min_gen = 0
if current_val then
    current_min_gen = tonumber(current_val) or 0
end

if target_min_gen > current_min_gen then
    if ttl and ttl > 0 then
        redis.call('set', min_gen_key, tostring(target_min_gen), 'EX', ttl)
    else
        redis.call('set', min_gen_key, tostring(target_min_gen))
    end
    return target_min_gen
end

return current_min_gen
`;

/**
 * Lua-скрипт для атомарной ротации refresh token с защитой от race conditions (TOCTOU) и replay detection (§30, §32 SPEC.md).
 * KEYS[1]: auth:session:{sessionId}
 * ARGV[1]: newRefreshTokenHash (string)
 * ARGV[2]: nowIso (string)
 * ARGV[3]: nowMs (number)
 * ARGV[4]: ttlSeconds (number)
 * ARGV[5]: sessionId (string)
 *
 * Возвращает:
 * - nil: сессия не найдена
 * - "REPLAY": обнаружена повторная попытка использования старого токена (сессия удалена)
 * - JSON-строка обновленной сессии в случае успеха
 */
export const ROTATE_SESSION_LUA = `
local session_key = KEYS[1]
local new_hash = ARGV[1]
local now_iso = ARGV[2]
local now_ms = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])
local session_id = ARGV[5]

local raw = redis.call('get', session_key)
if not raw then
    return nil
end

local session = cjson.decode(raw)
if session.refreshTokenHash == new_hash then
    redis.call('del', session_key)
    if session.userId then
        local user_sessions_key = "auth:user:" .. session.userId .. ":sessions"
        redis.call('zrem', user_sessions_key, session_id)
    end
    return "REPLAY"
end

session.refreshTokenHash = new_hash
session.lastUsedAt = now_iso
local updated_raw = cjson.encode(session)

if ttl and ttl > 0 then
    redis.call('set', session_key, updated_raw, 'EX', ttl)
    if session.userId and now_ms then
        local user_sessions_key = "auth:user:" .. session.userId .. ":sessions"
        local expire_at_ms = now_ms + (ttl * 1000)
        redis.call('zremrangebyscore', user_sessions_key, '-inf', '(' .. now_ms)
        redis.call('zadd', user_sessions_key, expire_at_ms, session_id)
        redis.call('expire', user_sessions_key, ttl)
    end
else
    redis.call('set', session_key, updated_raw)
end

return updated_raw
`;

@Injectable()
export class AuthSessionService {
  private readonly logger = new Logger(AuthSessionService.name);

  /**
   * @param redisService - Глобальный `RedisService` для доступа к Redis.
   * @param configService - Конфигурация приложения (секция `jwt.refreshExpiresIn`).
   */
  constructor(
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Создаёт новую authentication session (§14–16, §18 SPEC.md).
   *
   * Session сохраняется под переданным `sessionId` — тем же UUID, что
   * зашит в claim `sid` access/refresh JWT (§37 SPEC.md), чтобы `/auth/refresh`
   * находил session по `sid`.
   *
   * @param sessionId - UUID v4 сессии, сгенерированный вызывающим кодом (§14 SPEC.md).
   * @param userId - UUID пользователя.
   * @param refreshTokenHash - HMAC-SHA-256 хеш refresh token.
   * @param tokenFamilyId - UUID семейства токенов.
   * @param generation - Опциональное поколение авторизации пользователя.
   * @returns Созданная session.
   * @throws {Error} При ошибке Redis.
   */
  async createSession(
    sessionId: string,
    userId: string,
    refreshTokenHash: string,
    tokenFamilyId: string,
    generation?: number,
  ): Promise<AuthSession> {
    const now = new Date().toISOString();
    const nowMs = Date.now();

    const session: AuthSession = {
      userId,
      refreshTokenHash,
      tokenFamilyId,
      createdAt: now,
      lastUsedAt: now,
      ...(generation !== undefined && { generation }),
    };

    const ttlSeconds = getRefreshTokenTtlSeconds(this.configService);
    const sessionKey = this.key(sessionId);
    const minGenKey = `auth:user:${userId}:min_generation`;
    const userSessionsKey = this.userSessionsKey(userId);

    // Атомарная проверка generation через Redis Lua fence и индексация в ZSET (§CWE-362, Task 7)
    const result = await this.redisService.eval<number>(
      CREATE_SESSION_LUA,
      [minGenKey, sessionKey, userSessionsKey],
      [
        generation !== undefined ? generation : "",
        JSON.stringify(session),
        ttlSeconds,
        sessionId,
        nowMs,
      ],
    );

    if (result === -1) {
      this.logger.warn(
        `Session creation rejected for user ${userId}: generation ${generation} is older than min_generation`,
      );
      throw new UnauthorizedException("Invalid credentials");
    }

    this.logger.debug(`Session created: ${sessionId}`);
    return session;
  }

  /**
   * Проверяет, активна ли session (live-проверка для гуардов, §16, A8/P5).
   *
   * Использует `EXISTS auth:session:{sid}` — без чтения и парсинга JSON
   * для снижения roundtrip. Исключение Redis пробрасывается наверх
   * (Nest отдаёт `500`).
   *
   * @param sessionId - UUID сессии.
   * @returns `true`, если session существует (активна), иначе `false`.
   * @throws {Error} При ошибке Redis.
   */
  async isSessionActive(sessionId: string): Promise<boolean> {
    return this.redisService.exists(this.key(sessionId));
  }

  /**
   * Получает session по ID (§16 SPEC.md).
   *
   * @param sessionId - UUID сессии.
   * @returns Session или `null`, если не найдена.
   * @throws {Error} При ошибке Redis.
   */
  async getSession(sessionId: string): Promise<AuthSession | null> {
    const raw = await this.redisService.get(this.key(sessionId));
    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as AuthSession;
  }

  /**
   * Обновляет поля существующей session (§16 SPEC.md).
   *
   * @param sessionId - UUID сессии.
   * @param fields - Частичные поля для обновления.
   * @returns Обновлённая session или `null`, если session не найдена.
   * @throws {Error} При ошибке Redis.
   */
  async updateSession(
    sessionId: string,
    fields: Partial<Pick<AuthSession, "refreshTokenHash" | "lastUsedAt">>,
  ): Promise<AuthSession | null> {
    const existing = await this.getSession(sessionId);
    if (!existing) {
      return null;
    }

    const updated: AuthSession = { ...existing, ...fields };
    const ttlSeconds = getRefreshTokenTtlSeconds(this.configService);
    await this.redisService.set(
      this.key(sessionId),
      JSON.stringify(updated),
      ttlSeconds,
    );

    const nowMs = Date.now();
    const expireAtMs = nowMs + ttlSeconds * 1000;
    const userSessionsKey = this.userSessionsKey(updated.userId);
    await this.redisService
      .eval(
        `
        local now_ms = tonumber(ARGV[1])
        local expire_at_ms = tonumber(ARGV[2])
        local session_id = ARGV[3]
        local ttl = tonumber(ARGV[4])
        redis.call('zremrangebyscore', KEYS[1], '-inf', '(' .. now_ms)
        redis.call('zadd', KEYS[1], expire_at_ms, session_id)
        if ttl and ttl > 0 then
            redis.call('expire', KEYS[1], ttl)
        end
        return 1
        `,
        [userSessionsKey],
        [nowMs, expireAtMs, sessionId, ttlSeconds],
      )
      .catch(() => undefined);

    return updated;
  }

  /**
   * Удаляет session (§32 SPEC.md).
   *
   * @param sessionId - UUID сессии.
   * @throws {Error} При ошибке Redis.
   */
  async deleteSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    await this.redisService.delete(this.key(sessionId));
    if (session?.userId) {
      const userSessionsKey = this.userSessionsKey(session.userId);
      await this.redisService
        .eval(
          `redis.call('zrem', KEYS[1], ARGV[1])`,
          [userSessionsKey],
          [sessionId],
        )
        .catch(() => undefined);
    }
    this.logger.debug(`Session deleted: ${sessionId}`);
  }

  /**
   * Выполняет атомарную ротацию refresh token с replay detection (§30, §32 SPEC.md).
   *
   * Использует Lua-скрипт для атомарной проверки, предотвращая TOCTOU race conditions.
   * Сравнивает входящий `newRefreshTokenHash` с сохранённым. При совпадении
   * — replay detected → revoke session → возвращает `null`.
   * При несовпадении — обновляет хеш и `lastUsedAt`, продлевает TTL в сессии и ZSET.
   *
   * @param sessionId - UUID сессии.
   * @param newRefreshTokenHash - HMAC-SHA-256 хеш нового refresh token.
   * @returns Обновлённая session или `null` при replay detection / отсутствии сессии.
   * @throws {Error} При ошибке Redis.
   */
  async rotateSession(
    sessionId: string,
    newRefreshTokenHash: string,
  ): Promise<AuthSession | null> {
    const ttlSeconds = getRefreshTokenTtlSeconds(this.configService);
    const nowIso = new Date().toISOString();
    const nowMs = Date.now();
    const sessionKey = this.key(sessionId);

    const result = await this.redisService.eval<string | null>(
      ROTATE_SESSION_LUA,
      [sessionKey],
      [newRefreshTokenHash, nowIso, nowMs, ttlSeconds, sessionId],
    );

    if (!result) {
      return null;
    }

    if (result === "REPLAY") {
      this.logger.warn(`Replay detected for session ${sessionId} — revoking`);
      return null;
    }

    return JSON.parse(result) as AuthSession;
  }

  /**
   * Отзывает (удаляет) session (§32 SPEC.md).
   *
   * @param sessionId - UUID сессии.
   * @throws {Error} При ошибке Redis.
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.deleteSession(sessionId);
  }

  /**
   * Отзывает все сессии пользователя (logout all / смена пароля / деактивация).
   *
   * Выбирает актуальные сессии из ZSET `auth:user:{userId}:sessions` и выполняет
   * fallback-сканирование `auth:session:*` для гарантированного отзыва legacy-сессий,
   * созданных до внедрения ZSET-индексации или во время rolling deployment (§CWE-613).
   *
   * @param userId - UUID пользователя, чьи сессии отзываются.
   * @param maxCreatedAt - Опциональная временная граница создания сессий.
   * @param maxGeneration - Опциональная граница поколения авторизации.
   * @throws {Error} При ошибке Redis.
   */
  async revokeAllUserSessions(
    userId: string,
    maxCreatedAt?: Date | string,
    maxGeneration?: number,
  ): Promise<void> {
    const ttlSeconds = getRefreshTokenTtlSeconds(this.configService);
    if (maxGeneration !== undefined) {
      // Атомарно устанавливаем max(currentMinGen, targetMinGen) без возможности уменьшения fence (§CWE-362)
      const minGenKey = `auth:user:${userId}:min_generation`;
      const targetMinGen = maxGeneration + 1;
      await this.redisService.eval<number>(
        UPDATE_MIN_GEN_LUA,
        [minGenKey],
        [targetMinGen, ttlSeconds],
      );
    }

    const userSessionsKey = this.userSessionsKey(userId);
    const nowMs = Date.now();

    const indexedSessionIds =
      (await this.redisService.eval<string[]>(
        GET_USER_ACTIVE_SESSIONS_LUA,
        [userSessionsKey],
        [nowMs],
      )) || [];

    // Fallback и обработка смешанного состояния (§CWE-613):
    // Сканируем auth:session:* для обнаружения legacy-сессий без ZSET-индекса.
    const scannedKeys = await this.redisService.scanKeys(
      `${REDIS_SESSION_PREFIX}*`,
    );

    const allSessionKeysSet = new Set<string>();
    if (Array.isArray(indexedSessionIds)) {
      for (const sid of indexedSessionIds) {
        allSessionKeysSet.add(this.key(sid));
      }
    }
    if (Array.isArray(scannedKeys)) {
      for (const key of scannedKeys) {
        allSessionKeysSet.add(key);
      }
    }

    const allSessionKeys = Array.from(allSessionKeysSet);
    if (allSessionKeys.length === 0) {
      return;
    }

    // Обрабатываем сессии пачками через MGET для предотвращения N сетевых roundtrip (§Performance)
    const BATCH_SIZE = 100;
    for (let i = 0; i < allSessionKeys.length; i += BATCH_SIZE) {
      const chunkKeys = allSessionKeys.slice(i, i + BATCH_SIZE);
      const rawSessions = await this.redisService.mget(chunkKeys);

      for (let j = 0; j < chunkKeys.length; j++) {
        const sessionKey = chunkKeys[j];
        const raw = rawSessions[j];
        const sessionId = sessionKey.startsWith(REDIS_SESSION_PREFIX)
          ? sessionKey.slice(REDIS_SESSION_PREFIX.length)
          : sessionKey;

        if (!raw) {
          // Ключ сессии уже истек или удален — удаляем из ZSET
          await this.redisService
            .eval(
              `redis.call('zrem', KEYS[1], ARGV[1])`,
              [userSessionsKey],
              [sessionId],
            )
            .catch(() => undefined);
          continue;
        }

        try {
          const session = JSON.parse(raw) as AuthSession;
          if (session.userId === userId) {
            // Проверка поколения: если задан maxGeneration и generation > maxGeneration — пропускаем
            if (
              maxGeneration !== undefined &&
              session.generation !== undefined &&
              session.generation > maxGeneration
            ) {
              continue;
            }

            // Проверка даты создания: если задан maxCreatedAt и sessionCreatedAtMs > maxCreatedAtMs — пропускаем
            if (maxCreatedAt !== undefined) {
              const sessionCreatedAtMs = new Date(session.createdAt).getTime();
              const maxCreatedAtMs = new Date(maxCreatedAt).getTime();
              if (
                !Number.isNaN(sessionCreatedAtMs) &&
                !Number.isNaN(maxCreatedAtMs) &&
                sessionCreatedAtMs > maxCreatedAtMs
              ) {
                continue;
              }
            }

            await this.redisService.delete(sessionKey);
            await this.redisService
              .eval(
                `redis.call('zrem', KEYS[1], ARGV[1])`,
                [userSessionsKey],
                [sessionId],
              )
              .catch(() => undefined);
            this.logger.debug(
              `Session revoked for user ${userId}: ${sessionKey}`,
            );
          }
        } catch {
          this.logger.warn(`Skipped invalid session payload at ${sessionKey}`);
        }
      }
    }

    // Если фильтры не были заданы (полный логаут пользователя), очищаем ZSET
    if (maxCreatedAt === undefined && maxGeneration === undefined) {
      await this.redisService.delete(userSessionsKey).catch(() => undefined);
    }
  }

  /**
   * Формирует Redis-ключ сессии (§15 SPEC.md).
   *
   * @param sessionId - UUID сессии.
   * @returns Redis-ключ вида `auth:session:{sessionId}`.
   */
  private key(sessionId: string): string {
    return `${REDIS_SESSION_PREFIX}${sessionId}`;
  }

  /**
   * Формирует Redis-ключ индекса сессий пользователя (Sorted Set).
   *
   * @param userId - UUID пользователя.
   * @returns Redis-ключ вида `auth:user:{userId}:sessions`.
   */
  private userSessionsKey(userId: string): string {
    return `auth:user:${userId}:sessions`;
  }
}
