export type QueryParamValue =
  | string
  | number
  | boolean
  | null
  | undefined
  | Array<string | number | boolean>;

export type QueryParamsRecord = Record<string, QueryParamValue>;

export interface BuildUrlOptions {
  params?: QueryParamsRecord;
  hash?: string;
}

function appendParams(url: URL, params?: QueryParamsRecord): void {
  if (!params) return;

  for (const [key, value] of Object.entries(params)) {
    const values = Array.isArray(value) ? value : [value];

    for (const item of values) {
      if (item === null || item === undefined || item === "") {
        continue;
      }

      url.searchParams.append(key, String(item));
    }
  }
}

function createUrl(
  baseUrl: string,
  pathname: string,
  params?: QueryParamsRecord,
  hash?: string,
): string {
  const cleanPath = pathname ? pathname.replace(/^\/+/, "") : "";
  const url = new URL(cleanPath, baseUrl);

  url.pathname = url.pathname.replace(/\/+/g, "/");

  appendParams(url, params);

  if (typeof hash === "string" && hash.length > 0) {
    url.hash = hash.startsWith("#") ? hash : `#${hash}`;
  }

  return url.toString();
}

/**
 * Универсальный билдер URL для работы с параметрами запроса (query parameters).
 *
 * Принимает плоский объект `QueryParamsRecord`. Имена ключей (включая `hash` и `params`)
 * сериализуются исключительно как query-параметры.
 *
 * @param baseUrl - Базовый URL (например `https://example.com`).
 * @param pathname - Путь (например `/dashboard/sandbox`).
 * @param params - Объект query-параметров.
 * @returns Сформированный абсолютный URL.
 */
export function buildUrl(
  baseUrl: string,
  pathname: string,
  params?: QueryParamsRecord,
): string {
  return createUrl(baseUrl, pathname, params);
}

/**
 * Билдер URL со строго типизированными расширенными опциями `{ params, hash }`.
 *
 * Используется, когда необходимо сформировать URL с URI-хэшем (`#section`)
 * и опциональными query-параметрами.
 *
 * @param baseUrl - Базовый URL.
 * @param pathname - Путь.
 * @param options - Объект опций `{ params, hash }`.
 * @returns Сформированный абсолютный URL.
 */
export function buildUrlWithOptions(
  baseUrl: string,
  pathname: string,
  options?: BuildUrlOptions,
): string {
  return createUrl(baseUrl, pathname, options?.params, options?.hash);
}
