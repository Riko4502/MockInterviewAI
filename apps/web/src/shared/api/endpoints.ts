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

export const endpoints = {
  auth: {
    login: "/auth/login",
    register: "/auth/register",
    refresh: "/auth/refresh",
    logout: "/auth/logout",
  },
} as const;
