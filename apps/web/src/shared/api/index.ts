/**
 * Публичный API-слой веб-приложения (shared/api).
 *
 * Обеспечивает:
 * 1. Гарантированную инициализацию сетевого транспорта @packages/api через baseFetch.
 * 2. Реэкспорт инфраструктурных утилит.
 * 3. Реэкспорт сгенерированного API-клиента и хуков из @packages/api.
 */

import { initApiTransport } from "./http/init";

// Гарантированная инициализация HTTP-транспорта при загрузке модуля shared/api
initApiTransport();

export * from "@packages/api";
export { RefreshSessionError, refreshAccessToken } from "./auth/auth-session";
export { authToken } from "./auth/auth-token";
export { getApiUrl, realtimeWsUrl } from "./config/endpoints";
export { baseFetch, HttpError } from "./http/base";
export {
  createBaseFetchTransport,
  initApiTransport,
  isApiTransportInitialized,
  resetApiTransportState,
} from "./http/init";
export { createQueryClient } from "./query/query-client";
