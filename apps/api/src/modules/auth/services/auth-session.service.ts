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
 * Lua-скрипт для атомарной проверки generation fence и сохранения сессии (§CWE-362).
 * KEYS[1]: auth:user:{userId}:min_generation
 * KEYS[2]: auth:session:{sessionId}
 * ARGV[1]: generation (number | "")
 * ARGV[2]: session JSON
 * ARGV[3]: ttlSeconds (number)
 *
 * Возвращает 1 в случае успеха, -1 если generation устарел.
 */
export const CREATE_SESSION_LUA = `
local min_gen_key = KEYS[1]
local session_key = KEYS[2]
local generation = tonumber(ARGV[1])
local session_json = ARGV[2]
local ttl = tonumber(ARGV[3])

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
else
    redis.call('set', session_key, session_json)
end

return 1
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

    // Атомарная проверка generation через Redis Lua fence (§CWE-362):
    // если поколение пользователя уже было инкрементировано (смена пароля/деактивация),
    // сессия атомарно отклоняется без записи в Redis.
    const result = await this.redisService.eval<number>(
      CREATE_SESSION_LUA,
      [minGenKey, sessionKey],
      [
        generation !== undefined ? generation : "",
        JSON.stringify(session),
        ttlSeconds,
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

    return updated;
  }

  /**
   * Удаляет session (§32 SPEC.md).
   *
   * @param sessionId - UUID сессии.
   * @throws {Error} При ошибке Redis.
   */
  async deleteSession(sessionId: string): Promise<void> {
    await this.redisService.delete(this.key(sessionId));
    this.logger.debug(`Session deleted: ${sessionId}`);
  }

  /**
   * Выполняет rotation refresh token с replay detection (§30, §32 SPEC.md).
   *
   * Сравнивает входящий `newRefreshTokenHash` с сохранённым. При совпадении
   * — replay detected → revoke session → возвращает `null`.
   * При несовпадении — обновляет хеш и `lastUsedAt`, продлевает TTL.
   *
   * @param sessionId - UUID сессии.
   * @param newRefreshTokenHash - HMAC-SHA-256 хеш нового refresh token.
   * @returns Обновлённая session или `null` при replay detection.
   * @throws {Error} При ошибке Redis.
   */
  async rotateSession(
    sessionId: string,
    newRefreshTokenHash: string,
  ): Promise<AuthSession | null> {
    const session = await this.getSession(sessionId);
    if (!session) {
      return null;
    }

    if (session.refreshTokenHash === newRefreshTokenHash) {
      this.logger.warn(`Replay detected for session ${sessionId} — revoking`);
      await this.deleteSession(sessionId);
      return null;
    }

    return this.updateSession(sessionId, {
      refreshTokenHash: newRefreshTokenHash,
      lastUsedAt: new Date().toISOString(),
    });
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
   * Отзывает (удаляет) authentication session пользователя (§66 SPEC.md).
   *
   * Проходит по ключам `auth:session:*` через `SCAN`-итерацию, читает каждый
   * session и удаляет те, чей `userId` совпадает с переданным.
   * Если указан `maxGeneration`, удаляются сессии с `session.generation <= maxGeneration`.
   * Если указан `maxCreatedAt`, удаляются сессии, созданные не позднее этой временной метки.
   * Сессии других пользователей не затрагиваются. Отсутствие сессий — no-op.
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

    const keys = await this.redisService.scanKeys(`${REDIS_SESSION_PREFIX}*`);

    for (const key of keys) {
      const raw = await this.redisService.get(key);
      if (!raw) {
        continue;
      }
      try {
        const session = JSON.parse(raw) as AuthSession;
        if (session.userId === userId) {
          if (maxGeneration !== undefined && session.generation !== undefined) {
            if (session.generation > maxGeneration) {
              continue;
            }
          } else if (maxCreatedAt !== undefined) {
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
          await this.redisService.delete(key);
          this.logger.debug(`Session revoked for user ${userId}: ${key}`);
        }
      } catch {
        // Некорректный JSON в несессионном ключе — пропускаем, не удаляем.
        this.logger.warn(`Skipped invalid session payload at ${key}`);
      }
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
}
