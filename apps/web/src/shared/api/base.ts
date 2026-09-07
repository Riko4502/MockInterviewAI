/**
 * Базовый HTTP-клиент с поддержкой access token и автоматического refresh.
 *
 * ## Как это работает
 *
 * - `baseFetch()` выполняет HTTP-запросы к API.
 * - Access token хранится только в памяти приложения и автоматически
 *   добавляется в заголовок `Authorization`.
 * - При ответе `401 Unauthorized` выполняется попытка обновить access token.
 * - Refresh token хранится в HttpOnly cookie и отправляется браузером
 *   автоматически благодаря `credentials: "include"`.
 * - После успешного refresh исходный запрос повторяется один раз
 *   с новым access token.
 * - Ответ `204 No Content` корректно обрабатывается без вызова `response.json()`.
 * - Для `FormData` заголовок `Content-Type` не выставляется вручную,
 *   чтобы браузер самостоятельно добавил multipart boundary.
 */

import { RefreshSessionError, refreshAccessToken } from "./auth-session";
import { authToken } from "./auth-token";
import { apiUrl } from "./endpoints";

export class HttpError extends Error {
  constructor(
    message: string,
    public status: number,
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

  const response = await fetch(`${apiUrl}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status !== 401) {
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
      window.location.href = "/login";
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

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new HttpError(`HTTP ${response.status}`, response.status);
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
