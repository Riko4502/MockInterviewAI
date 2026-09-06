/**
 * Публичный API-слой веб-приложения (shared/api).
 *
 * Обеспечивает:
 * 1. Гарантированную инициализацию сетевого транспорта @packages/api через baseFetch.
 * 2. Реэкспорт инфраструктурных утилит (QueryProvider, baseFetch).
 * 3. Реэкспорт сгенерированного API-клиента и хуков из @packages/api.
 */

import { initApiTransport } from "./init";

// Гарантированная инициализация HTTP-транспорта при загрузке модуля shared/api
initApiTransport();

export * from "@packages/api";
export { AuthError, baseFetch } from "./base";
export { QueryProvider } from "./client";
export { apiUrl, realtimeWsUrl } from "./endpoints";
export {
  createBaseFetchTransport,
  initApiTransport,
  isApiTransportInitialized,
  resetApiTransportState,
} from "./init";
