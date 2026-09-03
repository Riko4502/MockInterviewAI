import { Injectable, Logger } from "@nestjs/common";
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
}

/**
 * Сервис управления authentication sessions в Redis (§13–18, §30–32, §39 SPEC.md).
 *
 * Отвечает за: создание/чтение/обновление/удаление session,
 * rotation refresh token с replay detection, привязку TTL к `JWT_REFRESH_EXPIRATION`.
 */
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
   * @returns Созданная session.
   * @throws {Error} При ошибке Redis.
   */
  async createSession(
    sessionId: string,
    userId: string,
    refreshTokenHash: string,
    tokenFamilyId: string,
  ): Promise<AuthSession> {
    const now = new Date().toISOString();

    const session: AuthSession = {
      userId,
      refreshTokenHash,
      tokenFamilyId,
      createdAt: now,
      lastUsedAt: now,
    };

    const ttlSeconds = getRefreshTokenTtlSeconds(this.configService);
    await this.redisService.set(
      this.key(sessionId),
      JSON.stringify(session),
      ttlSeconds,
    );

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
   * Отзывает все authentication session пользователя (§66 SPEC.md).
   *
   * Проходит по ключам `auth:session:*` через `SCAN`-итерацию, читает каждый
   * session и удаляет те, чей `userId` совпадает с переданным. Сессии других
   * пользователей не затрагиваются. Отсутствие сессий — no-op.
   *
   * @param userId - UUID пользователя, чьи сессии отзываются.
   * @throws {Error} При ошибке Redis.
   */
  async revokeAllUserSessions(userId: string): Promise<void> {
    const keys = await this.redisService.scanKeys(`${REDIS_SESSION_PREFIX}*`);

    for (const key of keys) {
      const raw = await this.redisService.get(key);
      if (!raw) {
        continue;
      }
      try {
        const session = JSON.parse(raw) as AuthSession;
        if (session.userId === userId) {
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
