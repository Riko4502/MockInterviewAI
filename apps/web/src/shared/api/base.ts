/**
 * Базовый слой для HTTP-запросов с поддержкой аутентификации.
 *
 * ## Как это работает
 *
 * - `baseFetch()` — универсальная обёртка над fetch. Автоматически добавляет
 *   `Authorization: Bearer <token>` из sessionStorage ко всем запросам.
 * - При ответе 401 пытается обновить токен через `/auth/refresh` (куки).
 * - Если рефреш успешен — повторяет исходный запрос с новым токеном.
 * - Если рефреш не удался — очищает токен и редиректит на `/login`.
 *
 * ## Использование
 *
 * ```ts
 * import { baseFetch } from "@/shared/api/base";
 *
 * const data = await baseFetch<MyType>("/some/endpoint");
 * const data = await baseFetch<MyType>("/some/endpoint", {
 *   method: "POST",
 *   body: JSON.stringify(payload),
 * });
 * ```
 *
 * ## Важно
 *
 * - Токен хранится в sessionStorage (сбрасывается при закрытии вкладки).
 * - Refresh-токен предполагается в httpOnly cookie (не доступен из JS).
 * - При рефреше новый accessToken приходит в теле ответа.
 */

import { apiUrl, endpoints } from "./endpoints";

interface RefreshResponse {
  accessToken: string;
}

export class AuthError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function baseFetch<T>(
  url: string,
  options: RequestInit = {},
): Promise<T> {
  const token = sessionStorage.getItem("accessToken");
  const headers = new Headers(options.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${apiUrl}${url}`, {
    ...options,
    headers,
    credentials: "include",
  });

  if (response.status === 401) {
    const refreshed = await tryRefreshToken();
    if (refreshed) {
      headers.set(
        "Authorization",
        `Bearer ${sessionStorage.getItem("accessToken")}`,
      );

      const retryResponse = await fetch(`${apiUrl}${url}`, {
        ...options,
        headers,
        credentials: "include",
      });

      if (!retryResponse.ok) {
        throw new AuthError(
          "Request failed after token refresh",
          retryResponse.status,
        );
      }

      return retryResponse.json();
    }

    sessionStorage.removeItem("accessToken");
    window.location.href = "/login";
    throw new AuthError("Session expired", 401);
  }

  if (!response.ok) {
    throw new AuthError(`HTTP ${response.status}`, response.status);
  }

  return response.json();
}

async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${apiUrl}${endpoints.auth.refresh}`, {
      method: "POST",
      credentials: "include",
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as RefreshResponse;
    sessionStorage.setItem("accessToken", data.accessToken);
    return true;
  } catch {
    return false;
  }
}
