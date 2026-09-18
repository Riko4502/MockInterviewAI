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

/**
 * Универсальный билдер URL на базе нативного Web API (URL).
 *
 * - Безопасно объединяет базовый URL и путь, нормализуя слеши.
 * - Сериализует параметры запроса (`queryParams`), игнорируя `null`, `undefined` и пустые строки.
 * - Поддерживает массивы параметров (`tag: ['a', 'b']` -> `tag=a&tag=b`).
 * - Поддерживает хэш-фрагменты (`#section`).
 *
 * @param baseUrl - Базовый URL (например `https://example.com` или `http://localhost:3000`).
 * @param pathname - Путь (например `/dashboard/sandbox` или `api/v1/users`).
 * @param optionsOrParams - Объект параметров запроса или расширенные опции `{ params, hash }`.
 * @returns Сформированный абсолютный URL.
 */
export function buildUrl(
  baseUrl: string,
  pathname: string,
  optionsOrParams?: QueryParamsRecord | BuildUrlOptions,
): string {
  const cleanPath = pathname ? pathname.replace(/^\/+/, "") : "";
  const url = new URL(cleanPath, baseUrl);
  url.pathname = url.pathname.replace(/\/+/g, "/");

  if (!optionsOrParams) {
    return url.toString();
  }

  const isExtendedOptions =
    "params" in optionsOrParams || "hash" in optionsOrParams;

  const params: QueryParamsRecord | undefined = isExtendedOptions
    ? (optionsOrParams as BuildUrlOptions).params
    : (optionsOrParams as QueryParamsRecord);

  const hash: string | undefined = isExtendedOptions
    ? (optionsOrParams as BuildUrlOptions).hash
    : undefined;

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null && item !== "") {
            url.searchParams.append(key, String(item));
          }
        }
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  }

  if (hash) {
    url.hash = hash.startsWith("#") ? hash : `#${hash}`;
  }

  return url.toString();
}
