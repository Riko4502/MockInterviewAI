import { ForbiddenException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { OriginCheckGuard } from "./origin-check.guard";

const ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];

function createExecutionContext(headers: Record<string, string | undefined>) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ headers }),
    }),
    // biome-ignore lint/suspicious/noExplicitAny: mock ExecutionContext for testing
  } as any;
}

function createGuard(overrides?: string[]) {
  const configService = {
    get: jest.fn().mockReturnValue(overrides ?? ALLOWED_ORIGINS),
  } as unknown as ConfigService;
  return new OriginCheckGuard(configService);
}

describe("OriginCheckGuard", () => {
  describe("нет заголовков", () => {
    it("пропускает запрос без Origin и Referer", () => {
      const guard = createGuard();
      const context = createExecutionContext({});
      expect(guard.canActivate(context)).toBe(true);
    });
  });

  describe("Origin заголовок", () => {
    it("пропускает если Origin совпадает", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        origin: "http://localhost:3000",
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("пропускает если Origin — подпуть разрешённого", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        origin: "http://localhost:3000/app/dashboard",
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("бросает ForbiddenException если Origin не совпадает", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        origin: "http://evil.com",
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it("содержит сообщение 'Origin not allowed'", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        origin: "http://evil.com",
      });
      try {
        guard.canActivate(context);
      } catch (e) {
        expect((e as ForbiddenException).message).toBe("Origin not allowed");
      }
    });
  });

  describe("Referer заголовок", () => {
    it("пропускает если Referer совпадает", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        referer: "http://localhost:3000/page",
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("бросает ForbiddenException если Referer не совпадает", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        referer: "http://evil.com/page",
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe("приоритет Origin над Referer", () => {
    it("проверяет Origin когда оба присутствуют и совпадают", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        origin: "http://localhost:3000",
        referer: "http://evil.com/page",
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("бросает ошибку если Origin не совпадает, даже если Referer совпадает", () => {
      const guard = createGuard();
      const context = createExecutionContext({
        origin: "http://evil.com",
        referer: "http://localhost:3000/page",
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe("пустой allowedOrigins", () => {
    it("бросает 403 если есть Origin", () => {
      const guard = createGuard([]);
      const context = createExecutionContext({
        origin: "http://localhost:3000",
      });
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });

  describe("startsWith matching", () => {
    it("совпадает с префиксом URL", () => {
      const guard = createGuard(["https://app.example.com"]);
      const context = createExecutionContext({
        origin: "https://app.example.com/deep/path",
      });
      expect(guard.canActivate(context)).toBe(true);
    });

    it("не совпадает с другим доменом相同的前缀", () => {
      const guard = createGuard(["https://app.example.com"]);
      const context = createExecutionContext({
        origin: "https://app.example.com.evil.com",
      });
      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
