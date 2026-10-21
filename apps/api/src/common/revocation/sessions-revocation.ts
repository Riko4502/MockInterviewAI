import type { AuthSessionService } from "../../modules/auth/services/auth-session.service";
import type { RedisService } from "../../redis/redis.service";
import { publishUserRevocationOrThrow } from "../pubsub/revocation";

/** Зависимости отзыва сессий — без Nest-контейнера, чтобы переиспользовать из сервисов. */
export interface SessionsRevocationDeps {
  redisService: RedisService;
  authSessionService: AuthSessionService;
}

/**
 * Отзывает все активные сессии пользователя с повторными попытками (ADR-005).
 *
 * Вынесено из `UsersService`, потому что тот же отзыв нужен при привязке и
 * отвязке привязок (`TelegramService.link`, отвязки в `UsersService`), а не
 * только при деактивации. Логика единая: сначала ревокация в Redis, затем
 * публикация сигнала в `auth:revocations`, на который realtime-сервис
 * закрывает живые SSE-соединения. Публикация внутри ретрая намеренно: сигнал
 * без ревокации оставил бы живые соединения, а ревокация без сигнала — уже
 * открытые SSE-каналы.
 *
 * @throws {Error} После исчерпания попыток — вызывающий решает, считать ли это
 *   сбоем операции (durable-задача `AuthRevocationTask` остаётся для воркера).
 */
export async function revokeUserSessionsWithRetry(
  deps: SessionsRevocationDeps,
  userId: string,
  maxCreatedAt?: Date | string,
  maxGeneration?: number,
  retries = 3,
  delayMs = 50,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await deps.authSessionService.revokeAllUserSessions(
        userId,
        maxCreatedAt,
        maxGeneration,
      );
      await publishUserRevocationOrThrow(deps.redisService, userId);
      return;
    } catch (error) {
      if (attempt === retries) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
