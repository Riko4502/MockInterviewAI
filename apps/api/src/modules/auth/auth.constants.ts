/**
 * Константы модуля аутентификации (§15, §20, §24, §25 SPEC.md).
 *
 * Используются в `TokenService`, `AuthSessionService`, `AuthController`.
 */

/** Имя HttpOnly cookie для refresh token (§25 SPEC.md). */
export const REFRESH_TOKEN_COOKIE_NAME = "refresh_token";

/** Префикс ключа Redis для session (§15 SPEC.md). Формат: `auth:session:{sessionId}`. */
export const REDIS_SESSION_PREFIX = "auth:session:";

/** Тип access token (§20 SPEC.md). */
export const TOKEN_TYP_ACCESS = "access";

/** Тип refresh token (§24 SPEC.md). */
export const TOKEN_TYP_REFRESH = "refresh";
