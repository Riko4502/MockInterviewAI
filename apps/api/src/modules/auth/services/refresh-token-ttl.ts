import { ConfigService } from "@nestjs/config";
import ms from "ms";

/**
 * Вычисляет время жизни refresh token в секундах из конфига
 * `jwt.refreshExpiresIn` (§18, §24 SPEC.md).
 *
 * Единый источник истины для TTL Redis-сессии и cookie Max-Age —
 * оба значения всегда совпадают с временем истечения refresh JWT,
 * рассинхрон исключён.
 *
 * @param configService - Конфигурация приложения.
 * @returns Время жизни refresh token в секундах (округление вверх).
 */
export function getRefreshTokenTtlSeconds(
  configService: ConfigService,
): number {
  const expiresIn = configService.get<string>("jwt.refreshExpiresIn") ?? "7d";
  const ttlMs = ms(expiresIn as ms.StringValue);
  return Math.ceil(ttlMs / 1000);
}
