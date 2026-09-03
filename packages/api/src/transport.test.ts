import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  customInstance,
  defaultFetchTransport,
  getHttpTransport,
  type HttpTransport,
  isHttpTransportSet,
  type RequestConfig,
  resetHttpTransport,
  setHttpTransport,
  TransportNotInitializedError,
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

  describe("H. Transport Fail-Fast & Initialization Guard (FEAT-007)", () => {
    describe("H1. TransportNotInitializedError контракт и начальное состояние", () => {
      it("isHttpTransportSet() возвращает false по умолчанию при старте и после resetHttpTransport()", () => {
        expect(isHttpTransportSet()).toBe(false);
      });

      it("TransportNotInitializedError имеет корректный тип, имя и стандартное сообщение", () => {
        const error = new TransportNotInitializedError();

        expect(error).toBeInstanceOf(TransportNotInitializedError);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("TransportNotInitializedError");
        expect(error.message).toBe(
          "[@packages/api] HTTP transport has not been initialized. " +
            "You must call setHttpTransport() (or initApiTransport() in apps/web) " +
            "before making API requests.",
        );
        expect(error.message).toContain("setHttpTransport()");
        expect(error.message).toContain("initApiTransport()");
      });

      it("TransportNotInitializedError поддерживает передачу кастомного сообщения", () => {
        const customMsg = "Custom transport error message";
        const error = new TransportNotInitializedError(customMsg);

        expect(error.message).toBe(customMsg);
        expect(error.name).toBe("TransportNotInitializedError");
        expect(error).toBeInstanceOf(TransportNotInitializedError);
      });
    });

    describe("H2. Fail-fast в production-окружении (NODE_ENV === 'production')", () => {
      beforeEach(() => {
        resetHttpTransport();
        vi.stubEnv("NODE_ENV", "production");
      });

      afterEach(() => {
        vi.unstubAllEnvs();
        resetHttpTransport();
      });

      it("getHttpTransport() без зарегистрированного custom transport в production выбрасывает TransportNotInitializedError", () => {
        expect(() => getHttpTransport()).toThrow(TransportNotInitializedError);

        try {
          getHttpTransport();
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(TransportNotInitializedError);
          expect(err).toBeInstanceOf(Error);
          expect((err as Error).name).toBe("TransportNotInitializedError");
        }
      });

      it("customInstance() без зарегистрированного custom transport в production отклоняет Promise с TransportNotInitializedError", async () => {
        await expect(
          customInstance({ url: "/api/v1/profile", method: "GET" }),
        ).rejects.toThrow(TransportNotInitializedError);

        try {
          await customInstance({ url: "/api/v1/profile", method: "GET" });
        } catch (err: unknown) {
          expect(err).toBeInstanceOf(TransportNotInitializedError);
          expect(err).toBeInstanceOf(Error);
          expect((err as Error).name).toBe("TransportNotInitializedError");
        }
      });
    });

    describe("H3. Принудительный strict: true fail-fast и очистка параметров fetch", () => {
      beforeEach(() => {
        resetHttpTransport();
      });

      afterEach(() => {
        resetHttpTransport();
      });

      it("customInstance({ strict: true }) без зарегистрированного транспорта отклоняет запрос с TransportNotInitializedError в development/test", async () => {
        await expect(
          customInstance({
            url: "/api/v1/sessions",
            method: "GET",
            strict: true,
          }),
        ).rejects.toThrow(TransportNotInitializedError);
      });

      it("customInstance(url, { strict: true }) в двухпараметрической форме отклоняет запрос с TransportNotInitializedError", async () => {
        await expect(
          customInstance("/api/v1/sessions", {
            method: "GET",
            strict: true,
          }),
        ).rejects.toThrow(TransportNotInitializedError);
      });

      it("параметр strict не просачивается в RequestConfig переданный в кастомный transport (объектная форма)", async () => {
        const mockTransport = vi.fn().mockResolvedValue({ success: true });
        setHttpTransport(mockTransport);

        await customInstance({
          url: "/api/v1/users",
          method: "POST",
          data: { name: "John" },
          strict: true,
        });

        expect(mockTransport).toHaveBeenCalledTimes(1);
        const passedConfig = mockTransport.mock.calls[0][0];

        expect("strict" in passedConfig).toBe(false);
        expect(passedConfig.url).toBe("/api/v1/users");
        expect(passedConfig.method).toBe("POST");
        expect(passedConfig.data).toEqual({ name: "John" });
      });

      it("параметр strict не просачивается в RequestConfig переданный в кастомный transport (двухпараметрическая форма)", async () => {
        const mockTransport = vi.fn().mockResolvedValue({ success: true });
        setHttpTransport(mockTransport);

        await customInstance("/api/v1/users", {
          method: "POST",
          strict: true,
        });

        expect(mockTransport).toHaveBeenCalledTimes(1);
        const passedConfig = mockTransport.mock.calls[0][0];

        expect("strict" in passedConfig).toBe(false);
        expect(passedConfig.url).toBe("/api/v1/users");
        expect(passedConfig.method).toBe("POST");
      });
    });

    describe("H4. Предупреждение в development-окружении (console.warn latch)", () => {
      let warnSpy: ReturnType<typeof vi.spyOn>;

      beforeEach(() => {
        resetHttpTransport();
        vi.stubEnv("NODE_ENV", "development");
        warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      });

      afterEach(() => {
        warnSpy.mockRestore();
        vi.unstubAllEnvs();
        resetHttpTransport();
      });

      it("выводит console.warn при первом вызове без кастомного транспорта и продолжает выполнение через defaultFetchTransport", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: () => "application/json",
          },
          json: async () => ({ fallback: true }),
        });
        vi.stubGlobal("fetch", mockFetch);

        const result = await customInstance<{ fallback: boolean }>({
          url: "/api/v1/test-dev",
          method: "GET",
        });

        expect(result).toEqual({ fallback: true });
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledTimes(1);

        const warnMessage = String(warnSpy.mock.calls[0][0]);
        expect(warnMessage).toContain("[@packages/api]");
        expect(warnMessage).toContain(
          "HTTP transport has not been initialized",
        );
        expect(warnMessage).toContain("setHttpTransport()");
        expect(warnMessage).toContain("initApiTransport()");
      });

      it("предотвращает повторный спам в консоль при последующих вызовах (latch)", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: () => "application/json",
          },
          json: async () => ({ count: 1 }),
        });
        vi.stubGlobal("fetch", mockFetch);

        // Первый вызов
        await customInstance({ url: "/api/v1/call-1", method: "GET" });
        expect(warnSpy).toHaveBeenCalledTimes(1);

        // Второй вызов
        await customInstance({ url: "/api/v1/call-2", method: "GET" });
        // Третий вызов
        await customInstance({ url: "/api/v1/call-3", method: "GET" });

        // Предупреждение всё ещё вызвано ровно 1 раз
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });
    });

    describe("H5. Жизненный цикл транспорта: setHttpTransport(), повторная инициализация и resetHttpTransport()", () => {
      beforeEach(() => {
        resetHttpTransport();
      });

      afterEach(() => {
        resetHttpTransport();
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
      });

      it("setHttpTransport() переводит статус в инициализированный и направляет запросы в кастомный транспорт", async () => {
        const mockFetch = vi.fn();
        vi.stubGlobal("fetch", mockFetch);

        const mockTransport = vi.fn().mockResolvedValue({ user: "Alice" });
        expect(isHttpTransportSet()).toBe(false);

        setHttpTransport(mockTransport);
        expect(isHttpTransportSet()).toBe(true);

        const result = await customInstance({
          url: "/api/v1/user",
          method: "GET",
        });

        expect(result).toEqual({ user: "Alice" });
        expect(mockTransport).toHaveBeenCalledTimes(1);
        expect(mockFetch).not.toHaveBeenCalled();
      });

      it("повторный setHttpTransport() замещает активный транспорт, сохраняя статус инициализированности", async () => {
        const mockTransport1 = vi.fn().mockResolvedValue({ version: 1 });
        const mockTransport2 = vi.fn().mockResolvedValue({ version: 2 });

        // Первая инициализация
        setHttpTransport(mockTransport1);
        expect(isHttpTransportSet()).toBe(true);
        const res1 = await customInstance({
          url: "/api/v1/version",
          method: "GET",
        });
        expect(res1).toEqual({ version: 1 });
        expect(mockTransport1).toHaveBeenCalledTimes(1);
        expect(mockTransport2).not.toHaveBeenCalled();

        // Повторная инициализация
        setHttpTransport(mockTransport2);
        expect(isHttpTransportSet()).toBe(true);
        const res2 = await customInstance({
          url: "/api/v1/version",
          method: "GET",
        });
        expect(res2).toEqual({ version: 2 });
        expect(mockTransport1).toHaveBeenCalledTimes(1);
        expect(mockTransport2).toHaveBeenCalledTimes(1);
      });

      it("resetHttpTransport() сбрасывает статус, возвращает defaultFetchTransport и приводит к ошибке при следующем strict-запросе", async () => {
        const mockTransport = vi.fn().mockResolvedValue({ data: "ok" });

        setHttpTransport(mockTransport);
        expect(isHttpTransportSet()).toBe(true);

        // Сброс
        resetHttpTransport();
        expect(isHttpTransportSet()).toBe(false);
        expect(getHttpTransport()).toBe(defaultFetchTransport);

        // Последующий strict-запрос падает с ошибкой
        await expect(
          customInstance("/api/v1/data", { method: "GET", strict: true }),
        ).rejects.toThrow(TransportNotInitializedError);
        expect(mockTransport).not.toHaveBeenCalled();
      });

      it("resetHttpTransport() сбрасывает development warning latch, позволяя предупреждению сработать снова", async () => {
        vi.stubEnv("NODE_ENV", "development");
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const mockFetch = vi.fn().mockResolvedValue({
          ok: true,
          status: 200,
          headers: { get: () => "application/json" },
          json: async () => ({ ok: true }),
        });
        vi.stubGlobal("fetch", mockFetch);

        // Первый неинициализированный запрос -> предупреждение вызвано 1 раз
        await customInstance({ url: "/test-1", method: "GET" });
        expect(warnSpy).toHaveBeenCalledTimes(1);

        // Второй неинициализированный запрос -> предупреждение НЕ повторяется (latch активен)
        await customInstance({ url: "/test-2", method: "GET" });
        expect(warnSpy).toHaveBeenCalledTimes(1);

        // Выполняем сброс транспорта
        resetHttpTransport();

        // Запрос после reset -> предупреждение срабатывает снова (счётчик становится 2)
        await customInstance({ url: "/test-3", method: "GET" });
        expect(warnSpy).toHaveBeenCalledTimes(2);

        warnSpy.mockRestore();
      });
    });
  });
});
