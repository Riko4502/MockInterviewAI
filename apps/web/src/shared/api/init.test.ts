import {
  getHttpTransport,
  isHttpTransportSet,
  resetHttpTransport,
} from "@packages/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baseFetch } from "./base";
import {
  createBaseFetchTransport,
  initApiTransport,
  isApiTransportInitialized,
  resetApiTransportState,
} from "./init";

vi.mock("./base", () => ({
  baseFetch: vi.fn().mockResolvedValue({ success: true }),
}));

describe("initApiTransport", () => {
  beforeEach(() => {
    resetApiTransportState();
    resetHttpTransport();
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetApiTransportState();
    resetHttpTransport();
  });

  it("должен инициализировать транспорт и переключать флаг", () => {
    expect(isApiTransportInitialized()).toBe(false);

    initApiTransport();

    expect(isApiTransportInitialized()).toBe(true);
  });

  it("должен быть идемпотентным при повторных вызовах", () => {
    initApiTransport();
    expect(isApiTransportInitialized()).toBe(true);

    // Повторный вызов не должен падать или сбрасывать состояние
    initApiTransport();
    expect(isApiTransportInitialized()).toBe(true);
  });

  it("должен корректно делегировать запросы в baseFetch через активный транспорт", async () => {
    initApiTransport();

    const transport = getHttpTransport();
    const result = await transport<{ success: boolean }>({
      url: "/api/v1/sessions",
      method: "POST",
      params: { page: 1, limit: 10 },
      data: { title: "Test Session" },
      headers: { "X-Custom": "header-value" },
    });

    expect(baseFetch).toHaveBeenCalledTimes(1);
    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/sessions?page=1&limit=10",
      expect.objectContaining({
        method: "POST",
        headers: { "X-Custom": "header-value" },
        body: JSON.stringify({ title: "Test Session" }),
      }),
    );
    expect(result).toEqual({ success: true });
  });

  it("должен корректно передавать строковое тело без повторной сериализации", async () => {
    const transport = createBaseFetchTransport();

    await transport({
      url: "/api/v1/raw",
      method: "POST",
      data: '{"already":"json"}',
    });

    expect(baseFetch).toHaveBeenCalledWith(
      "/api/v1/raw",
      expect.objectContaining({
        method: "POST",
        body: '{"already":"json"}',
      }),
    );
  });

  it("должен автоматически инициализировать транспорт при импорте shared/api/index", async () => {
    // Сбрасываем перед проверкой
    resetApiTransportState();
    resetHttpTransport();
    expect(isApiTransportInitialized()).toBe(false);

    // Динамический импорт shared/api
    const api = await import("./index");
    expect(isApiTransportInitialized()).toBe(true);
    expect(typeof api.authControllerLogin).toBe("function");
    expect(typeof api.initApiTransport).toBe("function");
  });

  it("должен гарантировать инициализацию транспорта при импорте client.tsx", async () => {
    vi.resetModules();
    const { isApiTransportInitialized: checkInitialized } = await import(
      "./init"
    );
    expect(checkInitialized()).toBe(false);

    await import("./client");
    expect(checkInitialized()).toBe(true);
  });

  it("resetApiTransportState() синхронно сбрасывает локальный флаг и состояние в @packages/api", () => {
    // 1. Инициализируем транспорт
    initApiTransport();
    expect(isApiTransportInitialized()).toBe(true);
    expect(isHttpTransportSet()).toBe(true);

    // 2. Вызываем resetApiTransportState()
    resetApiTransportState();

    // 3. Синхронно (без промисов/таймеров) проверяем сброс обоих флагов
    expect(isApiTransportInitialized()).toBe(false);
    expect(isHttpTransportSet()).toBe(false);

    // 4. Повторная инициализация должна снова перевести оба флага в true
    initApiTransport();
    expect(isApiTransportInitialized()).toBe(true);
    expect(isHttpTransportSet()).toBe(true);
  });
});
