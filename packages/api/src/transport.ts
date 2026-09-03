/**
 * HTTP Transport & Dependency Inversion Layer for @packages/api
 *
 * Предоставляет изолированный контракт HTTP-транспорта и точку внедрения
 * реализаций (Dependency Inversion), позволяя apps/web передавать свой
 * аутентифицированный baseFetch рантайм без нарушения архитектурной
 * границы monorepo (Constitution Principle I: packages/* никогда не импортирует apps/*).
 */

/**
 * Конфигурация сетевого HTTP-запроса, формируемая Orval mutator'ом.
 */
export interface RequestConfig {
  url: string;
  method: string;
  params?: Record<string, unknown>;
  data?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
  responseType?: string;
}

/**
 * Сигнатура функции сетевого транспорта (Dependency Inversion Interface).
 */
export type HttpTransport = <T>(config: RequestConfig) => Promise<T>;

/**
 * Базовый fallback HTTP-транспорт на базе нативного fetch.
 * Используется в headless-скриптах и тестах до инициализации DI веб-приложением.
 */
export const defaultFetchTransport: HttpTransport = async <T>(
  config: RequestConfig,
): Promise<T> => {
  let url = config.url;

  if (config.params && Object.keys(config.params).length > 0) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(config.params)) {
      if (value !== undefined && value !== null) {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  const isFormData =
    typeof FormData !== "undefined" && config.data instanceof FormData;

  const headers: Record<string, string> = { ...config.headers };
  if (!isFormData && config.data && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const body = isFormData
    ? (config.data as BodyInit)
    : config.data
      ? typeof config.data === "string"
        ? config.data
        : JSON.stringify(config.data)
      : undefined;

  const response = await fetch(url, {
    method: config.method,
    headers,
    body,
    signal: config.signal,
    credentials: config.credentials,
  });

  if (!response.ok) {
    let errorData: unknown;
    try {
      errorData = await response.json();
    } catch {
      errorData = await response.text();
    }
    const error = new Error(
      `HTTP Error ${response.status}: ${response.statusText}`,
    );
    (error as Error & { status: number; data: unknown }).status =
      response.status;
    (error as Error & { status: number; data: unknown }).data = errorData;
    throw error;
  }

  if (response.status === 204) {
    return undefined as unknown as T;
  }

  const contentType = response.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
};

/**
 * Активный экземпляр транспорта.
 */
let activeTransport: HttpTransport = defaultFetchTransport;

/**
 * Устанавливает активный HTTP-транспорт приложения (Dependency Inversion).
 * Вызывается на этапе инициализации приложения (например, в apps/web/src/shared/api/init.ts).
 */
export function setHttpTransport(transport: HttpTransport): void {
  activeTransport = transport;
}

/**
 * Возвращает текущий активный HTTP-транспорт.
 */
export function getHttpTransport(): HttpTransport {
  return activeTransport;
}

/**
 * Сбрасывает активный транспорт на defaultFetchTransport (полезно для изоляции тестов).
 */
export function resetHttpTransport(): void {
  activeTransport = defaultFetchTransport;
}

/**
 * Пользовательский инстанс-мутатор для Orval (`override.mutator`).
 * Поддерживает как стандартный двухпараметрический вызов Orval `(url, options)`,
 * так и прямой вызов со структурированным объектом `RequestConfig`.
 * Делегирует выполнение активному транспорту activeTransport.
 */
export async function customInstance<TResponse>(
  config: RequestConfig,
): Promise<TResponse>;

export async function customInstance<TResponse>(
  url: string,
  options?: RequestInit,
): Promise<TResponse>;

export async function customInstance<TResponse>(
  urlOrConfig: string | RequestConfig,
  options?: RequestInit,
): Promise<TResponse> {
  if (typeof urlOrConfig === "object" && urlOrConfig !== null) {
    return activeTransport<TResponse>(urlOrConfig);
  }

  const headers: Record<string, string> = {};
  if (options?.headers) {
    if (typeof Headers !== "undefined" && options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(options.headers)) {
      for (const [key, value] of options.headers) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, options.headers);
    }
  }

  let bodyData: unknown = options?.body;
  if (typeof options?.body === "string") {
    const contentType = headers["Content-Type"] || headers["content-type"];
    if (contentType?.includes("application/json")) {
      try {
        bodyData = JSON.parse(options.body);
      } catch {
        bodyData = options.body;
      }
    }
  }

  const config: RequestConfig = {
    url: urlOrConfig,
    method: options?.method ?? "GET",
    headers,
    data: bodyData,
    signal: options?.signal ?? undefined,
    credentials: options?.credentials,
  };

  return activeTransport<TResponse>(config);
}
