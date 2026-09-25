import { type ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { InternalServiceKeyGuard } from "./internal-service-key.guard";

const SECRET = "test-internal-service-key-0123456789abcdef";

function createContext(headerValue?: string): ExecutionContext {
  const headers: Record<string, string | undefined> = {};
  if (headerValue !== undefined) {
    headers["x-internal-service-key"] = headerValue;
  }
  const request = {
    header: (name: string) => headers[name.toLowerCase()],
  };
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function createGuard(secret = SECRET): InternalServiceKeyGuard {
  const configService = {
    get: (key: string) =>
      key === "telegram.internalServiceKey" ? secret : undefined,
  } as unknown as ConfigService;
  return new InternalServiceKeyGuard(configService);
}

describe("InternalServiceKeyGuard", () => {
  it("пропускает запрос при совпадении ключа (constant-time)", () => {
    const guard = createGuard();
    expect(guard.canActivate(createContext(SECRET))).toBe(true);
  });

  it("401 при отсутствии заголовка X-Internal-Service-Key", () => {
    const guard = createGuard();
    expect(() => guard.canActivate(createContext())).toThrow(
      UnauthorizedException,
    );
  });

  it("401 при несовпадении ключа", () => {
    const guard = createGuard();
    expect(() =>
      guard.canActivate(createContext("wrong-service-key-value")),
    ).toThrow(UnauthorizedException);
  });

  it("401 без RangeError при разной длине заголовка (sha256 до сравнения)", () => {
    const guard = createGuard();
    expect(() => guard.canActivate(createContext("short"))).toThrow(
      UnauthorizedException,
    );
  });

  it("бросает ошибку при отсутствии конфигурации", () => {
    const configService = {
      get: () => undefined,
    } as unknown as ConfigService;
    expect(() => new InternalServiceKeyGuard(configService)).toThrow(
      "INTERNAL_SERVICE_KEY is not configured",
    );
  });
});
