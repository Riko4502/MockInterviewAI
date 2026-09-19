import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshSessionError } from "../auth/auth-session";
import { authToken } from "../auth/auth-token";
import { openNotificationStream } from "./notification-stream";

const mocks = vi.hoisted(() => ({ constructor: vi.fn(), refresh: vi.fn() }));
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
  authToken.set("access-token");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  authToken.clear();
  vi.unstubAllGlobals();
});

function connect() {
  openNotificationStream();
  const [url, options] = mocks.constructor.mock.calls[0];
  return { url, request: options.fetch as typeof fetch };
}

describe("notification stream transport", () => {
  it("sends Authorization and preserves the replay cursor and abort signal", async () => {
    const { url, request } = connect();
    expect(url.toString()).toBe("http://localhost:8080/sse/notifications");
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
  it("treats a temporary server failure as retryable", async () => {
    const { url, request } = connect();
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(request(url)).rejects.toThrow("temporarily unavailable");
  });
});
