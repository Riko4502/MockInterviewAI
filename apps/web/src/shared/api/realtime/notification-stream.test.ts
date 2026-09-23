import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshSessionError } from "../auth/auth-session";
import { authToken } from "../auth/auth-token";
import { openNotificationStream } from "./notification-stream";

const mocks = vi.hoisted(() => ({
  constructor: vi.fn(),
  refresh: vi.fn(),
  realtimeUrl: "ws://localhost:8080",
}));
vi.mock("../config/endpoints", () => ({
  get realtimeWsUrl() {
    return mocks.realtimeUrl;
  },
}));
vi.mock("eventsource", () => ({
  EventSource: class {
    constructor(...args: unknown[]) {
      mocks.constructor(...args);
    }
  },
}));
vi.mock("../auth/auth-session", () => ({
  refreshAccessToken: mocks.refresh,
  RefreshSessionError: class extends Error {
    status = 401;
  },
}));
const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.realtimeUrl = "ws://localhost:8080";
  vi.stubEnv("NODE_ENV", "development");
  authToken.set("access-token");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  authToken.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function connect() {
  openNotificationStream();
  const [url, options] = mocks.constructor.mock.calls[0];
  return { url, request: options.fetch as typeof fetch };
}

describe("notification stream transport", () => {
  it.each([
    "development",
    "production",
  ])("preserves secure protocols in %s", (environment) => {
    vi.stubEnv("NODE_ENV", environment);
    for (const protocol of ["wss", "https"]) {
      mocks.realtimeUrl = `${protocol}://realtime.example.com`;
      openNotificationStream();
      const url = mocks.constructor.mock.lastCall?.[0];
      expect(url?.toString()).toBe(
        "https://realtime.example.com/sse/notifications",
      );
    }
  });

  it.each([
    "localhost",
    "127.0.0.1",
    "[::1]",
  ])("allows insecure loopback %s only in development", (hostname) => {
    for (const protocol of ["ws", "http"]) {
      mocks.realtimeUrl = `${protocol}://${hostname}:8080`;
      openNotificationStream();
      const url = mocks.constructor.mock.lastCall?.[0];
      expect(url?.toString()).toBe(`http://${hostname}:8080/sse/notifications`);
    }
  });

  it.each([
    ["development", "ws://realtime.example.com"],
    ["development", "http://realtime.example.com"],
    ["development", "ws://localhost.example.com"],
    ["development", "http://127.0.0.1.example.com"],
    ["development", "ws://192.168.1.10"],
    ["development", "ftp://localhost"],
    ["production", "ws://realtime.example.com"],
    ["production", "http://realtime.example.com"],
    ["production", "ws://localhost:8080"],
    ["production", "http://127.0.0.1:8080"],
    ["production", "ws://[::1]:8080"],
  ])("rejects %s endpoint %s before reading the token or connecting", (environment, endpoint) => {
    vi.stubEnv("NODE_ENV", environment);
    mocks.realtimeUrl = endpoint;
    const getToken = vi.spyOn(authToken, "get");
    expect(() => openNotificationStream()).toThrow("requires HTTPS or WSS");
    expect(getToken).not.toHaveBeenCalled();
    expect(mocks.constructor).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends Authorization and preserves the replay cursor and abort signal", async () => {
    const { url, request } = connect();
    expect(url?.toString()).toBe("http://localhost:8080/sse/notifications");
    const controller = new AbortController();
    fetchMock.mockResolvedValue(new Response());
    await request(url, {
      headers: { "Last-Event-ID": "123-0" },
      signal: controller.signal,
    });
    const init = fetchMock.mock.calls[0][1];
    expect(new Headers(init?.headers).get("Authorization")).toBe(
      "Bearer access-token",
    );
    expect(new Headers(init?.headers).get("Last-Event-ID")).toBe("123-0");
    expect(init?.signal).toBe(controller.signal);
  });

  it("refreshes an expired token and retries the handshake", async () => {
    const { url, request } = connect();
    fetchMock
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response());
    mocks.refresh.mockImplementation(async () => {
      authToken.set("fresh-token");
    });
    await request(url);
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(
      new Headers(fetchMock.mock.calls[1][1]?.headers).get("Authorization"),
    ).toBe("Bearer fresh-token");
  });

  it("does not reconnect after logout aborts a pending refresh", async () => {
    const { url, request } = connect();
    const controller = new AbortController();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    mocks.refresh.mockImplementation(async () => {
      controller.abort();
    });
    await expect(request(url, { signal: controller.signal })).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 401 to stop reconnecting when the refresh session has expired", async () => {
    const { url, request } = connect();
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }));
    mocks.refresh.mockRejectedValue(new RefreshSessionError("Expired", 401));
    expect((await request(url)).status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  describe.each([429, 503])("Retry-After for %s", (status) => {
    it("waits for a distant HTTP date without firing early", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      const { url, request } = connect();
      const retryAfter = "Thu, 01 Jan 2099 00:00:00 GMT";
      const delay = Date.parse(retryAfter) - Date.now();
      fetchMock.mockResolvedValue(
        new Response("unavailable", {
          status,
          headers: { "Retry-After": retryAfter },
        }),
      );
      const settled = vi.fn();
      const pending = request(url).catch(settled);
      await vi.advanceTimersByTimeAsync(delay - 1);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Notification stream temporarily unavailable",
        }),
      );
    });
    it.each([
      ["7", 7_000],
      [null, 30_000],
      ["invalid", 30_000],
      ["Wed, 01 Jan 2025 00:00:12 GMT", 12_000],
      ["2147484", 2_147_484_000],
    ])("waits for %s before allowing reconnection", async (retryAfter, delay) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      const { url, request } = connect();
      const response = new Response("unavailable", {
        status,
        headers: retryAfter === null ? {} : { "Retry-After": retryAfter },
      });
      if (!response.body) throw new Error("Expected response body");
      const cancel = vi.spyOn(response.body, "cancel");
      fetchMock.mockResolvedValue(response);
      const settled = vi.fn();
      const pending = request(url).catch(settled);
      if (delay > 2_147_483_647) {
        await vi.advanceTimersByTimeAsync(2_147_483_647);
        expect(settled).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(1);
        await vi.advanceTimersByTimeAsync(delay - 2_147_483_647 - 1);
      } else {
        await vi.advanceTimersByTimeAsync(delay - 1);
      }
      expect(cancel).toHaveBeenCalledTimes(1);
      expect(settled).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Notification stream temporarily unavailable",
        }),
      );
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    });

    it.each([
      false,
      true,
    ])("cancels the wait when aborted (already aborted: %s)", async (alreadyAborted) => {
      vi.useFakeTimers();
      const { url, request } = connect();
      const controller = new AbortController();
      fetchMock.mockResolvedValue(new Response(null, { status }));
      if (alreadyAborted) controller.abort();
      const pending = request(url, { signal: controller.signal });
      const assertion = expect(pending).rejects.toMatchObject({
        name: "AbortError",
      });
      if (!alreadyAborted) {
        await vi.advanceTimersByTimeAsync(0);
        expect(vi.getTimerCount()).toBe(1);
        controller.abort();
      }
      await assertion;
      expect(vi.getTimerCount()).toBe(0);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
  it("treats a temporary server failure as retryable", async () => {
    const { url, request } = connect();
    fetchMock.mockResolvedValue(new Response(null, { status: 500 }));
    await expect(request(url)).rejects.toThrow("temporarily unavailable");
  });
});
