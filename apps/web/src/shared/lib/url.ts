import {
  type BuildUrlOptions,
  buildUrl,
  buildUrlWithOptions,
  type QueryParamsRecord,
} from "@packages/utils";

/**
 * Возвращает базовый публичный URL веб-приложения.
 *
 * - Читает `NEXT_PUBLIC_APP_URL` из окружения (приоритет).
 * - В браузере использует `window.location.origin` в качестве fallback.
 * - В SSR/Node fallback — `http://localhost:3000`.
 */
export function getAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && envUrl.trim() !== "") {
    let clean = envUrl.trim();
    while (clean.endsWith("/")) {
      clean = clean.slice(0, -1);
    }
    return clean;
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

/**
 * Универсальный билдер абсолютных URL веб-приложения для query-параметров.
 *
 * @param pathname - Относительный путь (например `/dashboard/sandbox` или `login`).
 * @param params - Параметры запроса.
 * @returns Полный абсолютный URL приложения.
 *
 * @example
 * ```ts
 * buildAppUrl("/dashboard/sandbox", { room: "123", invite: "token-abc" });
 * // => "http://localhost:3000/dashboard/sandbox?room=123&invite=token-abc"
 * ```
 */
export function buildAppUrl(
  pathname: string,
  params?: QueryParamsRecord,
): string {
  return buildUrl(getAppUrl(), pathname, params);
}

/**
 * Билдер абсолютных URL со строго типизированными расширенными опциями `{ params, hash }`.
 *
 * @example
 * ```ts
 * buildAppUrlWithOptions("/dashboard/sandbox", { params: { room: "123" }, hash: "invite=token-abc" });
 * // => "http://localhost:3000/dashboard/sandbox?room=123#invite=token-abc"
 * ```
 */
export function buildAppUrlWithOptions(
  pathname: string,
  options?: BuildUrlOptions,
): string {
  return buildUrlWithOptions(getAppUrl(), pathname, options);
}

export {
  buildUrl,
  buildUrlWithOptions,
  type BuildUrlOptions,
  type QueryParamsRecord,
};
