import { hostname } from "node:os";
import type { RedisService } from "../../redis/redis.service";

/**
 * Канал Redis Pub/Sub для глобальных сигналов отзыва авторизации.
 * Публикует `apps/api`, слушает `apps/realtime`.
 */
export const REVOCATION_CHANNEL = "auth:revocations";

/**
 * Собирает сообщение ревокации в формате Phase A:
 * `{"instanceId":"api-<hostname>","data":"<userId>"}` (+ `sessionId`, если передан).
 *
 * `sessionId` передаётся только для close-сессии (room-scoped evict, P2),
 * не для logout/replay/deactivate (user-level evict).
 */
export function buildRevocationMessage(
  userId: string,
  sessionId?: string,
): string {
  const message: Record<string, string> = {
    instanceId: `api-${hostname()}`,
    data: userId,
  };
  if (sessionId) {
    message.sessionId = sessionId;
  }
  return JSON.stringify(message);
}

/**
 * Публикует сигнал отзыва авторизации пользователя в канал `auth:revocations`.
 *
 * Best-effort: никогда не бросает исключений (как в `users.service.ts`),
 * чтобы сбой публикации не влиял на основной поток auth-обработки.
 */
export async function publishUserRevocation(
  redis: RedisService,
  userId: string,
  sessionId?: string,
): Promise<void> {
  try {
    await redis.publish(
      REVOCATION_CHANNEL,
      buildRevocationMessage(userId, sessionId),
    );
  } catch {
    // Игнорируем ошибку публикации, если realtime сервис не слушает
  }
}
