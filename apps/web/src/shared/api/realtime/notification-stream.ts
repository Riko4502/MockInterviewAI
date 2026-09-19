import { EventSource } from "eventsource";
import { RefreshSessionError, refreshAccessToken } from "../auth/auth-session";
import { authToken } from "../auth/auth-token";
import { realtimeWsUrl } from "../config/endpoints";

export function openNotificationStream() {
  const url = new URL(`${realtimeWsUrl.replace(/\/$/, "")}/sse/notifications`);
  if (url.protocol === "ws:") url.protocol = "http:";
  if (url.protocol === "wss:") url.protocol = "https:";

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
        throw new Error("Notification stream temporarily unavailable");
      }
      return response;
    },
  });
}
