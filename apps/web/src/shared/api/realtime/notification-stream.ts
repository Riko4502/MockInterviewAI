import { EventSource } from "eventsource";
import { RefreshSessionError, refreshAccessToken } from "../auth/auth-session";
import { authToken } from "../auth/auth-token";
import { realtimeWsUrl } from "../config/endpoints";

export function openNotificationStream() {
  const url = new URL(`${realtimeWsUrl.replace(/\/$/, "")}/sse/notifications`);
  const isLocalDevelopment =
    process.env.NODE_ENV === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol === "wss:") url.protocol = "https:";
  if (
    url.protocol !== "https:" &&
    !(isLocalDevelopment && ["ws:", "http:"].includes(url.protocol))
  ) {
    throw new Error(
      "Notification stream requires HTTPS or WSS outside local development",
    );
  }
  if (url.protocol === "ws:") url.protocol = "http:";

  return new EventSource(url, {
    fetch: async (input, init) => {
      const request = () => {
        const headers = new Headers(init?.headers);
        const token = authToken.get();
        if (token) headers.set("Authorization", `Bearer ${token}`);
        return fetch(input, { ...init, headers });
      };

      let response = await request();
      if (response.status === 401 && !init?.signal?.aborted) {
        await response.body?.cancel();
        try {
          await refreshAccessToken();
        } catch (error) {
          if (
            error instanceof RefreshSessionError &&
            (error.status === 401 || error.status === 403)
          )
            return response;
          throw error;
        }
        init?.signal?.throwIfAborted();
        response = await request();
      }
      if (response.status === 429 || response.status >= 500) {
        await response.body?.cancel();
        if (response.status === 429 || response.status === 503) {
          await waitForRetry(
            getRetryDelay(response.headers.get("Retry-After")),
            init?.signal,
          );
        }
        throw new Error("Notification stream temporarily unavailable");
      }
      return response;
    },
  });
}

function getRetryDelay(retryAfter: string | null): number {
  if (!retryAfter?.trim()) return 30_000;
  const value = retryAfter.trim();
  const delay = /^\d+$/.test(value)
    ? Number(value) * 1000
    : Date.parse(value) - Date.now();
  return Number.isFinite(delay) ? Math.max(0, delay) : 30_000;
}

function waitForRetry(
  delay: number,
  signal?: AbortSignal | null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();
    const onAbort = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, delay);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
