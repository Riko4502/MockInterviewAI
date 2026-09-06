/**
 * Web Runtime Transport Adapter for @packages/api
 *
 * Связывает сгенерированный API-клиент @packages/api с существующим
 * HTTP runtime веб-приложения (baseFetch) через паттерн Dependency Inversion.
 *
 * Архитектурные гарантии:
 * 1. @packages/api не зависит от apps/web и не импортирует код веб-приложения.
 * 2. apps/web инжектирует свой авторизованный baseFetch в @packages/api.
 * 3. Все сетевые запросы проходят через единый транспорт baseFetch (авторизация, refresh, credentials).
 */

import {
  type HttpTransport,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "@packages/api";
import { baseFetch } from "./base";

let initialized = false;

/**
 * Создаёт HTTP-транспорт адаптер, приводящий вызовы RequestConfig к baseFetch.
 */
export function createBaseFetchTransport(): HttpTransport {
  return async <T>(config: RequestConfig): Promise<T> => {
    const { url, method, params, data, headers, signal } = config;

    let fullUrl = url;
    if (params && Object.keys(params).length > 0) {
      const search = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) {
          search.append(k, String(v));
        }
      }
      const qs = search.toString();
      if (qs) {
        fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
      }
    }

    const body =
      typeof data === "string"
        ? data
        : typeof FormData !== "undefined" && data instanceof FormData
          ? data
          : data !== undefined && data !== null
            ? JSON.stringify(data)
            : undefined;

    return baseFetch<T>(fullUrl, {
      method,
      headers,
      body,
      signal,
    });
  };
}

/**
 * Инициализирует API-транспорт веб-приложения.
 * Гарантирует однократную регистрацию транспорта (идемпотентность).
 */
export function initApiTransport(): void {
  if (initialized) {
    return;
  }

  setHttpTransport(createBaseFetchTransport());
  initialized = true;
}

/**
 * Проверяет, был ли инициализирован транспорт (для тестов и отладки).
 */
export function isApiTransportInitialized(): boolean {
  return initialized;
}

/**
 * Сбрасывает состояние инициализации (для изоляции модульных тестов).
 */
export function resetApiTransportState(): void {
  initialized = false;
  resetHttpTransport();
}
