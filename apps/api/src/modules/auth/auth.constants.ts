/**
 * Константы модуля аутентификации (§15, §20, §24, §25 SPEC.md).
 *
 * Используются в `TokenService`, `AuthSessionService`.
 */

/** Префикс ключа Redis для session (§15 SPEC.md). Формат: `auth:session:{sessionId}`. */
export const REDIS_SESSION_PREFIX = "auth:session:";

/** Тип access token (§20 SPEC.md). */
export const TOKEN_TYP_ACCESS = "access";

/** Тип refresh token (§24 SPEC.md). */
export const TOKEN_TYP_REFRESH = "refresh";

/** Тип одноразового WS-тикета (Phase C). Подписывается access-секретом. */
export const TOKEN_TYP_REALTIME = "realtime";
