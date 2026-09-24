const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Ошибка ответа внутреннего API с HTTP-статусом и телом ответа.
 *
 * Позволяет хендлерам мапить статусы на пользовательские сценарии
 * (409 → уже привязано, 410 → токен истёк, 404 → не привязано и т.д.).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  internalServiceKey: string;
  timeoutMs?: number;
}

let options: ApiClientOptions | null = null;

/**
 * Инициализирует модульный HTTP-клиент к внутреннему API.
 *
 * Должен быть вызван до первого запроса (из `src/index.ts`). Локальная
 * инициализация вместо конструктора упрощает мокапинг в тестах хендлеров.
 *
 * @param clientOptions - Базовый URL, сервисный ключ и таймаут.
 */
export function initApiClient(clientOptions: ApiClientOptions): void {
  options = { timeoutMs: REQUEST_TIMEOUT_MS, ...clientOptions };
}

function currentOptions(): ApiClientOptions {
  if (options === null) {
    throw new Error("api-client is not initialized: call initApiClient first");
  }
  return options;
}

interface RequestOptions {
  method: "GET" | "POST" | "PATCH";
  body?: unknown;
  params?: Record<string, string>;
}

async function request<T>(path: string, req: RequestOptions): Promise<T> {
  const { baseUrl, internalServiceKey, timeoutMs } = currentOptions();

  const url = new URL(
    baseUrl.replace(/\/+$/, "") + (path.startsWith("/") ? path : `/${path}`),
  );
  if (req.params) {
    for (const [key, value] of Object.entries(req.params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Internal-Service-Key": internalServiceKey,
  };
  if (req.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url, {
    method: req.method,
    headers,
    body: req.body === undefined ? undefined : JSON.stringify(req.body),
    signal: AbortSignal.timeout(timeoutMs ?? REQUEST_TIMEOUT_MS),
  });

  const text = await response.text();
  let parsed: unknown;
  if (text.length > 0) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, parsed);
  }

  return parsed as T;
}

/**
 * GET-запрос к внутреннему API.
 *
 * @param path - Путь относительно `API_INTERNAL_URL` (например `/telegram/profile`).
 * @param params - Query-параметры (значения строковые).
 */
export function apiGet<T = unknown>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  return request<T>(path, { method: "GET", params });
}

/**
 * POST-запрос к внутреннему API (например `/telegram/link`).
 *
 * @param path - Путь относительно `API_INTERNAL_URL`.
 * @param body - JSON-тело запроса.
 */
export function apiPost<T = unknown>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body });
}

/**
 * PATCH-запрос к внутреннему API (например `/telegram/preferences`).
 *
 * @param path - Путь относительно `API_INTERNAL_URL`.
 * @param body - JSON-тело запроса.
 */
export function apiPatch<T = unknown>(
  path: string,
  body?: unknown,
): Promise<T> {
  return request<T>(path, { method: "PATCH", body });
}
