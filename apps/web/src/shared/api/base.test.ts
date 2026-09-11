import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RefreshSessionError, refreshAccessToken } from "./auth-session";
import { authToken } from "./auth-token";
import { baseFetch, HttpError } from "./base";

vi.mock("./auth-session", () => ({
  refreshAccessToken: vi.fn(),
  RefreshSessionError: class RefreshSessionError extends Error {
    constructor(
      message: string,
      public status?: number,
    ) {
      super(message);
      this.name = "RefreshSessionError";
    }
  },
}));

describe("baseFetch API Error Handling & Payload Preservation (CRIT-06)", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    authToken.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    authToken.clear();
  });

  it("400: сохраняет status 400, сообщение и распарсенное JSON тело ошибок валидации", async () => {
    const errorPayload = {
      statusCode: 400,
      message: {
        email: "Email обязателен",
        password: "Пароль должен содержать минимум 12 символов",
      },
      error: "Bad Request",
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(baseFetch("/test-endpoint")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(HttpError);
        const httpError = error as HttpError<typeof errorPayload>;
        expect(httpError.status).toBe(400);
        expect(httpError.data).toEqual(errorPayload);
        return true;
      },
    );
  });

  it("401 без access token: не запускает refresh и сразу выбрасывает HttpError со статусом 401", async () => {
    const errorPayload = { message: "Unauthorized" };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(baseFetch("/unauth-endpoint")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(HttpError);
        const httpError = error as HttpError;
        expect(httpError.status).toBe(401);
        expect(httpError.data).toEqual(errorPayload);
        return true;
      },
    );

    expect(refreshAccessToken).not.toHaveBeenCalled();
  });

  it("401 с access token: выполняет refresh и при успешном retry возвращает данные", async () => {
    authToken.set("expired-token");
    vi.mocked(refreshAccessToken).mockResolvedValueOnce("new-refreshed-token");

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, data: "hello" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    globalThis.fetch = fetchMock;

    const result = await baseFetch<{ success: boolean; data: string }>(
      "/protected",
    );

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ success: true, data: "hello" });
  });

  it("401 -> refresh OK -> retry 400: сохраняет реальный статус 400 и structured body (не подменяет на session expired)", async () => {
    authToken.set("expired-token");
    vi.mocked(refreshAccessToken).mockResolvedValueOnce("new-refreshed-token");

    const retryErrorPayload = {
      statusCode: 400,
      message: "Bad request on retry payload",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(retryErrorPayload), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
      );

    globalThis.fetch = fetchMock;

    await expect(baseFetch("/protected")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(HttpError);
        const httpError = error as HttpError<typeof retryErrorPayload>;
        expect(httpError.status).toBe(400);
        expect(httpError.message).toBe("Bad request on retry payload");
        expect(httpError.data).toEqual(retryErrorPayload);
        return true;
      },
    );

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
  });

  it("401 -> refresh OK -> retry 403: сохраняет реальный статус 403 и body", async () => {
    authToken.set("expired-token");
    vi.mocked(refreshAccessToken).mockResolvedValueOnce("new-refreshed-token");

    const retryErrorPayload = {
      statusCode: 403,
      message: "Forbidden: insufficient permissions",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(retryErrorPayload), {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }),
      );

    globalThis.fetch = fetchMock;

    await expect(baseFetch("/protected")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(HttpError);
        const httpError = error as HttpError<typeof retryErrorPayload>;
        expect(httpError.status).toBe(403);
        expect(httpError.message).toBe("Forbidden: insufficient permissions");
        expect(httpError.data).toEqual(retryErrorPayload);
        return true;
      },
    );
  });

  it("401 -> refresh OK -> retry 500: сохраняет реальный статус 500 и body", async () => {
    authToken.set("expired-token");
    vi.mocked(refreshAccessToken).mockResolvedValueOnce("new-refreshed-token");

    const retryErrorPayload = {
      statusCode: 500,
      message: "Internal server error during retry",
    };

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ message: "Token expired" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(retryErrorPayload), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      );

    globalThis.fetch = fetchMock;

    await expect(baseFetch("/protected")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(HttpError);
        const httpError = error as HttpError<typeof retryErrorPayload>;
        expect(httpError.status).toBe(500);
        expect(httpError.message).toBe("Internal server error during retry");
        expect(httpError.data).toEqual(retryErrorPayload);
        return true;
      },
    );
  });

  it("500: сохраняет status 500 и response body", async () => {
    const errorPayload = {
      statusCode: 500,
      message: "Database connection failed",
    };

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(errorPayload), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(baseFetch("/error-endpoint")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(HttpError);
        const httpError = error as HttpError<typeof errorPayload>;
        expect(httpError.status).toBe(500);
        expect(httpError.message).toBe("Database connection failed");
        expect(httpError.data).toEqual(errorPayload);
        return true;
      },
    );
  });

  it("non-JSON error: сохраняет текстовый ответ в { message: text }", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response("502 Bad Gateway: Nginx upstream down", {
        status: 502,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }),
    );

    await expect(baseFetch("/gateway-error")).rejects.toSatisfy(
      (error: unknown) => {
        expect(error).toBeInstanceOf(HttpError);
        const httpError = error as HttpError<{ message: string }>;
        expect(httpError.status).toBe(502);
        expect(httpError.message).toBe("502 Bad Gateway: Nginx upstream down");
        expect(httpError.data).toEqual({
          message: "502 Bad Gateway: Nginx upstream down",
        });
        return true;
      },
    );
  });

  it("204 No Content: успешно возвращает undefined", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 204,
      }),
    );

    const result = await baseFetch<void>("/no-content");
    expect(result).toBeUndefined();
  });

  it("refresh failure: пробрасывает RefreshSessionError", async () => {
    authToken.set("expired-token");
    vi.mocked(refreshAccessToken).mockRejectedValueOnce(
      new RefreshSessionError("Refresh session expired", 401),
    );

    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ message: "Token expired" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
    );

    await expect(baseFetch("/protected")).rejects.toBeInstanceOf(
      RefreshSessionError,
    );
  });
});
