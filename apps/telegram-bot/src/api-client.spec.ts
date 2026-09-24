import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  apiGet,
  apiPatch,
  apiPost,
  initApiClient,
} from "./api-client";

const BASE_URL = "http://localhost:3001/api/v1";
const SERVICE_KEY = "mock-internal-service-key-0123456789abcdef";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("api-client", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
    initApiClient({ baseUrl: BASE_URL, internalServiceKey: SERVICE_KEY });
    fetchMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("POST: шлёт X-Internal-Service-Key, JSON body и резолвит URL относительно API_INTERNAL_URL", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { success: true }));

    const result = await apiPost<{ success: boolean }>("/telegram/link", {
      token: "raw-token",
      chatId: "123456789",
    });

    expect(result).toEqual({ success: true });

    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(`${BASE_URL}/telegram/link`);
    expect(init.method).toBe("POST");
    expect(init.body).toBe(
      JSON.stringify({ token: "raw-token", chatId: "123456789" }),
    );
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Internal-Service-Key"]).toBe(SERVICE_KEY);
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("GET: передаёт query-параметры, PATCH: без body-поля Content-Type", async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { items: [] }));

    const result = await apiGet("/telegram/interviews", { chatId: "123" });
    expect(result).toEqual({ items: [] });

    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(String(url)).toBe(`${BASE_URL}/telegram/interviews?chatId=123`);

    fetchMock.mockResolvedValue(jsonResponse(200, { telegramLocale: "en" }));
    await apiPatch("/telegram/preferences", { chatId: "123", locale: "en" });

    const [, patchInit] = fetchMock.mock.calls[1] as [URL, RequestInit];
    expect(patchInit.method).toBe("PATCH");
    const patchHeaders = patchInit.headers as Record<string, string>;
    expect(patchHeaders["Content-Type"]).toBe("application/json");
  });

  it("пустой ответ (200, без тела) → undefined без падения", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 200 }));

    await expect(
      apiGet("/telegram/profile", { chatId: "1" }),
    ).resolves.toBeUndefined();
  });

  it("не-OK статус → ApiError со статусом и телом", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(410, { message: "Token expired" }),
    );

    const error = await apiPost("/telegram/link", {
      token: "t",
      chatId: "1",
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(410);
    expect((error as ApiError).body).toEqual({ message: "Token expired" });
  });

  it("маппинг 404/409/5xx в ApiError", async () => {
    for (const [status, body] of [
      [404, { message: "Not linked" }],
      [409, { message: "Already linked" }],
      [500, { error: "Internal" }],
    ] as const) {
      fetchMock.mockResolvedValue(jsonResponse(status, body));

      const error = await apiGet("/telegram/profile", { chatId: "1" }).catch(
        (e: unknown) => e,
      );
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(status);
    }
  });
});
