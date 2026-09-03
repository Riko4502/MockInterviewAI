import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  customInstance,
  defaultFetchTransport,
  getHttpTransport,
  type HttpTransport,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
} from "./transport";

describe("Unified @packages/api Transport Layer (T031)", () => {
  beforeEach(() => {
    resetHttpTransport();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    resetHttpTransport();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe("A. Default transport (defaultFetchTransport)", () => {
    it("использует defaultFetchTransport по умолчанию, если кастомный транспорт не установлен", () => {
      expect(getHttpTransport()).toBe(defaultFetchTransport);
    });

    it("корректно передаёт URL, метод, заголовки и тело через нативный fetch при вызове с RequestConfig", async () => {
      const mockResponseData = { accessToken: "jwt-test-token" };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => mockResponseData,
        text: async () => JSON.stringify(mockResponseData),
      });
      vi.stubGlobal("fetch", mockFetch);

      const payload = { email: "user@example.com", password: "Password123!" };
      const config: RequestConfig = {
        url: "/api/v1/auth/login",
        method: "POST",
        headers: { "X-Test-Header": "test-value" },
        data: payload,
      };

      const result = await customInstance<typeof mockResponseData>(config);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe("/api/v1/auth/login");
      expect(calledInit.method).toBe("POST");
      expect(calledInit.headers["Content-Type"]).toBe("application/json");
      expect(calledInit.headers["X-Test-Header"]).toBe("test-value");
      expect(calledInit.body).toBe(JSON.stringify(payload));
      expect(result).toEqual(mockResponseData);
    });

    it("корректно поддерживает двухпараметрический вызов Orval customInstance(url, options)", async () => {
      const mockResponseData = { ticket: "rtc-ticket-456" };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type" ? "application/json" : null,
        },
        json: async () => mockResponseData,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await customInstance<typeof mockResponseData>(
        "/api/v1/realtime/ticket",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: "sess-123" }),
        },
      );

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [calledUrl, calledInit] = mockFetch.mock.calls[0];
      expect(calledUrl).toBe("/api/v1/realtime/ticket");
      expect(calledInit.method).toBe("POST");
      expect(result).toEqual(mockResponseData);
    });

    it("корректно сериализует search params в query string", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json",
        },
        json: async () => [],
      });
      vi.stubGlobal("fetch", mockFetch);

      await customInstance({
        url: "/api/v1/sessions",
        method: "GET",
        params: { page: 1, limit: 10, status: "ACTIVE" },
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch.mock.calls[0][0]).toBe(
        "/api/v1/sessions?page=1&limit=10&status=ACTIVE",
      );
    });

    it("добавляет search params через & если URL уже содержит ?", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => "application/json",
        },
        json: async () => [],
      });
      vi.stubGlobal("fetch", mockFetch);

      await customInstance({
        url: "/api/v1/search?type=user",
        method: "GET",
        params: { q: "alex" },
      });

      expect(mockFetch.mock.calls[0][0]).toBe(
        "/api/v1/search?type=user&q=alex",
      );
    });
  });

  describe("B. setHttpTransport() & Dependency Inversion", () => {
    it("делегирует выполнение сетевого запроса установленному через DI транспорту", async () => {
      const mockFetch = vi.fn();
      vi.stubGlobal("fetch", mockFetch);

      const injectedResponse = { message: "from-injected-transport" };
      const mockTransport: HttpTransport = vi
        .fn()
        .mockResolvedValue(injectedResponse);

      setHttpTransport(mockTransport);
      expect(getHttpTransport()).toBe(mockTransport);

      const requestConfig: RequestConfig = {
        url: "/api/v1/profile/me",
        method: "GET",
      };

      const result =
        await customInstance<typeof injectedResponse>(requestConfig);

      expect(mockTransport).toHaveBeenCalledTimes(1);
      expect(mockTransport).toHaveBeenCalledWith(requestConfig);
      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual(injectedResponse);
    });
  });

  describe("C. resetHttpTransport()", () => {
    it("сбрасывает кастомный транспорт обратно на defaultFetchTransport", async () => {
      const mockTransport: HttpTransport = vi.fn();
      setHttpTransport(mockTransport);
      expect(getHttpTransport()).toBe(mockTransport);

      resetHttpTransport();
      expect(getHttpTransport()).toBe(defaultFetchTransport);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ reset: true }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await customInstance({ url: "/test", method: "GET" });
      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockTransport).not.toHaveBeenCalled();
      expect(result).toEqual({ reset: true });
    });
  });

  describe("D. Обработка HTTP-ошибок (HTTP Error)", () => {
    it("генерирует исключение при статусе ошибки и прикрепляет status и parsed JSON data", async () => {
      const errorBody = {
        message: "Invalid credentials",
        statusCode: 401,
      };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        json: async () => errorBody,
        text: async () => JSON.stringify(errorBody),
      });
      vi.stubGlobal("fetch", mockFetch);

      await expect(
        customInstance({ url: "/api/v1/auth/login", method: "POST" }),
      ).rejects.toThrow("HTTP Error 401: Unauthorized");

      try {
        await customInstance({ url: "/api/v1/auth/login", method: "POST" });
      } catch (err: unknown) {
        const error = err as Error & { status: number; data: unknown };
        expect(error.status).toBe(401);
        expect(error.data).toEqual(errorBody);
      }
    });

    it("корректно прикрепляет текстовый data, если тело ошибки не является валидным JSON", async () => {
      const errorText = "502 Bad Gateway: upstream timed out";
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: async () => {
          throw new Error("Invalid JSON");
        },
        text: async () => errorText,
      });
      vi.stubGlobal("fetch", mockFetch);

      try {
        await customInstance({ url: "/api/v1/health", method: "GET" });
      } catch (err: unknown) {
        const error = err as Error & { status: number; data: unknown };
        expect(error.status).toBe(502);
        expect(error.data).toBe(errorText);
      }
    });
  });

  describe("E. Парсинг ответа (JSON & Text)", () => {
    it("парсит JSON ответ при Content-Type application/json", async () => {
      const expectedData = { id: 1, name: "Test Object" };
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "content-type"
              ? "application/json; charset=utf-8"
              : null,
        },
        json: async () => expectedData,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await customInstance({
        url: "/api/v1/test",
        method: "GET",
      });
      expect(result).toEqual(expectedData);
    });

    it("возвращает сырой текст, если Content-Type не application/json", async () => {
      const expectedText = "plain-text-response";
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: {
          get: () => "text/plain",
        },
        text: async () => expectedText,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await customInstance({
        url: "/api/v1/text",
        method: "GET",
      });
      expect(result).toBe(expectedText);
    });
  });

  describe("F. Пустые ответы (Empty Response / HTTP 204)", () => {
    it("возвращает undefined при HTTP 204 No Content без попытки парсить тело", async () => {
      const mockJson = vi.fn();
      const mockText = vi.fn();
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        statusText: "No Content",
        headers: {
          get: () => null,
        },
        json: mockJson,
        text: mockText,
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await customInstance({
        url: "/api/v1/sessions/123/close",
        method: "POST",
      });

      expect(result).toBeUndefined();
      expect(mockJson).not.toHaveBeenCalled();
      expect(mockText).not.toHaveBeenCalled();
    });
  });

  describe("G. Изоляция Dependency Inversion между тестами", () => {
    it("изолирует состояние между отдельными тестами благодаря beforeEach/afterEach resetHttpTransport", () => {
      // Подтверждает, что если предыдущие тесты устанавливали мок-транспорт,
      // в новом тесте activeTransport гарантированно сброшен на defaultFetchTransport
      expect(getHttpTransport()).toBe(defaultFetchTransport);
    });
  });
});
