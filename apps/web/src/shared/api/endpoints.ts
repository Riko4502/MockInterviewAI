/**
 * Конфигурация урлов бэкенда.
 *
 * ## Использование
 *
 * ```ts
 * import { getApiUrl } from "@/shared/api/endpoints";
 * ```
 *
 * ## Важно
 *
 * - `NEXT_PUBLIC_API_URL` задаётся в `.env` или `.env.local`.
 * - Ленивая функция `getApiUrl()` валидирует переменную окружения в момент
 *   выполнения запроса, а не во время module evaluation, что позволяет Next.js
 *   успешно собирать статические страницы в production окружении без переданных ENV.
 */

export function getApiUrl(): string {
  const envApiUrl = process.env.NEXT_PUBLIC_API_URL;

  if (process.env.NODE_ENV === "production") {
    if (!envApiUrl || envApiUrl.trim() === "") {
      throw new Error(
        "NEXT_PUBLIC_API_URL is required in production environment",
      );
    }
    return envApiUrl;
  }

  return envApiUrl ?? "http://localhost:3001";
}

/**
 * Базовый URL realtime-сервера (WebSocket).
 *
 * - `NEXT_PUBLIC_REALTIME_URL` задаётся в `.env` или `.env.local`.
 * - Для комнаты сессии путь дополняется: `${realtimeWsUrl}/ws/sessions/{sessionId}`.
 */
export const realtimeWsUrl =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080";
