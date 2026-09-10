import type { AccessTokenResponseDto } from "@packages/api";
import { authToken } from "./auth-token";
import { getApiUrl } from "./endpoints";

let refreshPromise: Promise<string> | null = null;

export class RefreshSessionError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = "RefreshSessionError";
  }
}

/**
 * Обновляет access token через refresh token из HttpOnly cookie.
 *
 * Одновременно может выполняться только один refresh-запрос.
 * Параллельные вызовы ожидают один общий Promise.
 *
 * @returns новый access token
 * @throws RefreshSessionError если refresh не удался
 */
export async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = performRefresh();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function performRefresh(): Promise<string> {
  let response: Response;

  try {
    const apiUrl = getApiUrl();
    response = await fetch(`${apiUrl}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    throw new RefreshSessionError("Refresh request failed");
  }

  if (response.status === 401 || response.status === 403) {
    authToken.clear();

    throw new RefreshSessionError("Refresh session expired", response.status);
  }

  if (!response.ok) {
    throw new RefreshSessionError(
      `Refresh failed with HTTP ${response.status}`,
      response.status,
    );
  }

  const data = (await response.json()) as AccessTokenResponseDto;

  authToken.set(data.accessToken);

  return data.accessToken;
}
