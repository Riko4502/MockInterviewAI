/**
 * Базовый HTTP-клиент с поддержкой access token и автоматического refresh.
 *
 * ## Как это работает
 *
 * - `baseFetch()` выполняет HTTP-запросы к API.
 * - Access token хранится только в памяти приложения и автоматически
 *   добавляется в заголовок `Authorization`.
 * - При ответе `401 Unauthorized` и наличии токена выполняется попытка обновить access token.
 * - Refresh token хранится в HttpOnly cookie и отправляется браузером
 *   автоматически благодаря `credentials: "include"`.
 * - После успешного refresh исходный запрос повторяется один раз
 *   с новым access token.
 * - Ошибки API (400, 403, 500 и т.д.) сохраняют статус и structured data в HttpError.
 * - Ответ `204 No Content` корректно обрабатывается без вызова `response.json()`.
 * - Для `FormData` заголовок `Content-Type` не выставляется вручную,
 *   чтобы браузер самостоятельно добавил multipart boundary.
 */

import { RefreshSessionError, refreshAccessToken } from "./auth-session";
import { authToken } from "./auth-token";
import { getApiUrl } from "./endpoints";

export class HttpError<T = unknown> extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: T,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export async function baseFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const headers = createHeaders(options.headers, options.body);
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  const hasToken = !!authToken.get();

  if (response.status !== 401 || !hasToken) {
    return handleResponse<T>(response);
  }

  try {
    const newToken = await refreshAccessToken();

    headers.set("Authorization", `Bearer ${newToken}`);

    const retryResponse = await fetch(`${apiUrl}${url}`, {
      ...options,
      headers,
      credentials: "include",
    });

    return handleResponse<T>(retryResponse);
  } catch (error) {
    if (
      error instanceof RefreshSessionError &&
      (error.status === 401 || error.status === 403)
    ) {
      authToken.clear();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }

    throw error;
  }
}

function createHeaders(init?: HeadersInit, body?: BodyInit | null): Headers {
  const headers = new Headers(init);
  const token = authToken.get();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData = body instanceof FormData;

  if (!headers.has("Content-Type") && !isFormData) {
    headers.set("Content-Type", "application/json");
  }

  return headers;
}

async function extractErrorPayload(
  response: Response,
): Promise<{ message: string; data?: unknown }> {
  let errorData: unknown;
  const contentType = response.headers.get("content-type");

  if (contentType?.includes("application/json")) {
    try {
      errorData = await response.json();
    } catch {
      // JSON parse fallback
    }
  } else {
    try {
      const text = await response.text();
      if (text) {
        errorData = { message: text };
      }
    } catch {
      // text read fallback
    }
  }

  let message = `HTTP ${response.status}`;
  if (
    typeof errorData === "object" &&
    errorData !== null &&
    "message" in errorData &&
    typeof (errorData as { message: unknown }).message === "string"
  ) {
    message = (errorData as { message: string }).message;
  } else if (
    typeof errorData === "object" &&
    errorData !== null &&
    "error" in errorData &&
    typeof (errorData as { error: unknown }).error === "string"
  ) {
    message = (errorData as { error: string }).error;
  }

  return { message, data: errorData };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const { message, data } = await extractErrorPayload(response);
    throw new HttpError(message, response.status, data);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type");

  if (!contentType?.includes("application/json")) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
