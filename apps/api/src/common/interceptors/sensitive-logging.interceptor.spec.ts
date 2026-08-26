import { Logger } from "@nestjs/common";
import { of } from "rxjs";
import { SensitiveLoggingInterceptor } from "./sensitive-logging.interceptor";

function createExecutionContext(
  method: string,
  url: string,
  headers: Record<string, string> = {},
) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ method, url, headers }),
    }),
    // biome-ignore lint/suspicious/noExplicitAny: mock ExecutionContext for testing
  } as any;
}

function createCallHandler() {
  // biome-ignore lint/suspicious/noExplicitAny: mock CallHandler for testing
  return { handle: () => of(null) } as any;
}

describe("SensitiveLoggingInterceptor", () => {
  let interceptor: SensitiveLoggingInterceptor;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    interceptor = new SensitiveLoggingInterceptor();
    logSpy = jest.spyOn(Logger.prototype, "log").mockImplementation();
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it("логирует method, url и latency", (done) => {
    const context = createExecutionContext("GET", "/api/v1/health");
    const next = createCallHandler();

    interceptor.intercept(context, next).subscribe(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      const message = logSpy.mock.calls[0][0] as string;
      expect(message).toMatch(/^GET \/api\/v1\/health \d+ms$/);
      done();
    });
  });

  it("latency — неотрицательное число", (done) => {
    const context = createExecutionContext("POST", "/api/v1/auth/register");
    const next = createCallHandler();

    interceptor.intercept(context, next).subscribe(() => {
      const message = logSpy.mock.calls[0][0] as string;
      const match = message.match(/(\d+)ms$/);
      expect(match).not.toBeNull();
      expect(Number(match?.[1])).toBeGreaterThanOrEqual(0);
      done();
    });
  });

  it("не логирует body запроса", (done) => {
    const context = createExecutionContext("POST", "/api/v1/auth/register");
    const next = createCallHandler();

    interceptor.intercept(context, next).subscribe(() => {
      const allCalls = logSpy.mock.calls.flat().join(" ");
      expect(allCalls).not.toContain("password");
      expect(allCalls).not.toContain("secret");
      expect(allCalls).not.toContain("token");
      done();
    });
  });

  it("пропускает observable без изменений", (done) => {
    const context = createExecutionContext("GET", "/api/v1/health");
    const expectedResult = { status: "ok" };
    // biome-ignore lint/suspicious/noExplicitAny: mock CallHandler for testing
    const next = { handle: () => of(expectedResult) } as any;

    interceptor.intercept(context, next).subscribe((result) => {
      expect(result).toBe(expectedResult);
      done();
    });
  });

  it("логирует разные методы", (done) => {
    const methods = ["GET", "POST", "PUT", "DELETE"];
    let completed = 0;

    for (const method of methods) {
      const context = createExecutionContext(method, "/test");
      const next = createCallHandler();

      interceptor.intercept(context, next).subscribe(() => {
        const message = logSpy.mock.calls[completed][0] as string;
        expect(message).toMatch(new RegExp(`^${method} /test \\d+ms$`));
        completed++;
        if (completed === methods.length) done();
      });
    }
  });
});
