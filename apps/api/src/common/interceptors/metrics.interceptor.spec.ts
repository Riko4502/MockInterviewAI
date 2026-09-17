import { HttpException } from "@nestjs/common";
import { lastValueFrom, of, throwError } from "rxjs";

import { MetricsService } from "../metrics/metrics.service";
import { MetricsInterceptor } from "./metrics.interceptor";

function createExecutionContext(
  method: string,
  routePath: string,
  statusCode = 200,
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, route: { path: routePath } }),
      getResponse: () => ({ statusCode }),
    }),
    // biome-ignore lint/suspicious/noExplicitAny: mock ExecutionContext for testing
  } as any;
}

describe("MetricsInterceptor", () => {
  let interceptor: MetricsInterceptor;
  let requestFinished: jest.Mock;
  let requestStarted: jest.Mock;

  beforeEach(() => {
    requestFinished = jest.fn();
    requestStarted = jest.fn();
    const metricsService = {
      requestFinished,
      requestStarted,
      // biome-ignore lint/suspicious/noExplicitAny: partial mock
    } as any;
    interceptor = new MetricsInterceptor(
      metricsService as unknown as MetricsService,
    );
  });

  it("фиксирует статус и роут для успешного запроса", async () => {
    const context = createExecutionContext("GET", "/api/v1/health");
    const next = { handle: () => of({ status: "ok" }) };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(requestStarted).toHaveBeenCalledTimes(1);
    expect(requestFinished).toHaveBeenCalledWith(
      { method: "GET", route: "/api/v1/health", statusCode: 200 },
      expect.any(Number),
    );
    expect(requestFinished.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
  });

  it("использует уже установленный статус ответа (201)", async () => {
    const context = createExecutionContext("POST", "/api/v1/users", 201);
    const next = { handle: () => of({ id: 1 }) };

    await lastValueFrom(interceptor.intercept(context, next));

    expect(requestFinished).toHaveBeenCalledWith(
      { method: "POST", route: "/api/v1/users", statusCode: 201 },
      expect.any(Number),
    );
  });

  it("фиксирует статус HttpException, а не дефолтный 200", async () => {
    const context = createExecutionContext("GET", "/api/v1/users/42");
    const next = {
      handle: () => throwError(() => new HttpException("not found", 404)),
    };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBeInstanceOf(HttpException);

    expect(requestFinished).toHaveBeenCalledWith(
      { method: "GET", route: "/api/v1/users/42", statusCode: 404 },
      expect.any(Number),
    );
  });

  it("фиксирует 500 для неизвестной ошибки", async () => {
    const context = createExecutionContext("GET", "/api/v1/users/42");
    const next = { handle: () => throwError(() => new Error("boom")) };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toThrow();

    expect(requestFinished).toHaveBeenCalledWith(
      { method: "GET", route: "/api/v1/users/42", statusCode: 500 },
      expect.any(Number),
    );
  });

  it("пробрасывает исключение дальше (не проглатывает)", async () => {
    const context = createExecutionContext("GET", "/x");
    const originalError = new HttpException("conflict", 409);
    const next = { handle: () => throwError(() => originalError) };

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).rejects.toBe(originalError);
  });
});
