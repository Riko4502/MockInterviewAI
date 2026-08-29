import { SetMetadata } from "@nestjs/common";

/** Ключ метаданных для `@Public()` decorator (§64 SPEC.md). */
export const IS_PUBLIC_KEY = "isPublic";

/**
 * Декоратор исключения endpoint из глобального `AccessTokenGuard` (§64 SPEC.md).
 *
 * Устанавливает метаданные `isPublic = true` на handler method.
 * Guard проверяет наличие этой метаданных и пропускает запрос без
 * проверки access token.
 *
 * Применяется на: health check, register, login, swagger routes.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
