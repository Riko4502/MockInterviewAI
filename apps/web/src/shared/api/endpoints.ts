/**
 * Конфигурация урлов бэкенда.
 *
 * ## Использование
 *
 * ```ts
 * import { endpoints, apiUrl } from "@/shared/api/endpoints";
 *
 * fetch(`${apiUrl}${endpoints.auth.login}`, ...)
 * ```
 *
 * ## Важно
 *
 * - `NEXT_PUBLIC_API_URL` задаётся в `.env` или `.env.local`.
 * - Эндпоинты нужно синхронизировать с бэкендом.
 */

// TODO: заменить на реальные эндпоинты бэкенда
export const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/**
 * Базовый URL realtime-сервера (WebSocket).
 *
 * - `NEXT_PUBLIC_REALTIME_URL` задаётся в `.env` или `.env.local`.
 * - Для комнаты сессии путь дополняется: `${realtimeWsUrl}/ws/sessions/{sessionId}`.
 */
export const realtimeWsUrl =
  process.env.NEXT_PUBLIC_REALTIME_URL ?? "ws://localhost:8080";

export const endpoints = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },
  realtime: {
    ticket: "/realtime/ticket",
  },
} as const;
