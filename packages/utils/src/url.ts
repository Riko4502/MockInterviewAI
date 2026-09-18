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
 * Универсальный билдер URL.
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
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const cleanPath = pathname ? `/${pathname.replace(/^\/+/, "")}` : "";
  const fullPath = `${cleanBase}${cleanPath}`;

  if (!optionsOrParams) {
    return fullPath;
  }

  const isExtendedOptions =
    "params" in optionsOrParams || "hash" in optionsOrParams;

  const params: QueryParamsRecord | undefined = isExtendedOptions
    ? (optionsOrParams as BuildUrlOptions).params
    : (optionsOrParams as QueryParamsRecord);

  const hash: string | undefined = isExtendedOptions
    ? (optionsOrParams as BuildUrlOptions).hash
    : undefined;

  const query = new URLSearchParams();

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === "") {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item !== undefined && item !== null && item !== "") {
            query.append(key, String(item));
          }
        }
      } else {
        query.append(key, String(value));
      }
    }
  }

  const queryString = query.toString();
  const cleanHash = hash ? `#${hash.replace(/^#+/, "")}` : "";

  let result = fullPath;
  if (queryString) {
    result += `?${queryString}`;
  }
  if (cleanHash) {
    result += cleanHash;
  }

  return result;
}
