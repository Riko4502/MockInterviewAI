import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("endpoints configuration (CRIT-07 lazy evaluation)", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    const env = process.env as Record<string, string | undefined>;
    if (originalNodeEnv !== undefined) {
      env.NODE_ENV = originalNodeEnv;
    } else {
      delete env.NODE_ENV;
    }

    if (originalApiUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
    vi.unstubAllEnvs();
  });

  describe("module evaluation and import resilience", () => {
    it("A. module import без NEXT_PUBLIC_API_URL не падает в production", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
      delete process.env.NEXT_PUBLIC_API_URL;

      // Модуль должен успешно импортироваться без ошибок на этапе evaluation
      const endpointsModule = await import("./endpoints");
      expect(endpointsModule.getApiUrl).toBeDefined();
      expect(typeof endpointsModule.getApiUrl).toBe("function");
    });
  });

  describe("production environment runtime validation", () => {
    it("C. production request без API URL выбрасывает понятную диагностическую ошибку при вызове getApiUrl()", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
      delete process.env.NEXT_PUBLIC_API_URL;

      const { getApiUrl } = await import("./endpoints");
      expect(() => getApiUrl()).toThrow(
        "NEXT_PUBLIC_API_URL is required in production environment",
      );
    });

    it("D. production request с API URL использует переданный URL", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "production";
      process.env.NEXT_PUBLIC_API_URL = "https://api.mockinterview.com";

      const { getApiUrl } = await import("./endpoints");
      expect(getApiUrl()).toBe("https://api.mockinterview.com");
    });
  });

  describe("development environment", () => {
    it("B. использует fallback на localhost:3001 при отсутствии NEXT_PUBLIC_API_URL в development", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "development";
      delete process.env.NEXT_PUBLIC_API_URL;

      const { getApiUrl } = await import("./endpoints");
      expect(getApiUrl()).toBe("http://localhost:3001");
    });

    it("B. использует заданный NEXT_PUBLIC_API_URL в development при его наличии", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV =
        "development";
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";

      const { getApiUrl } = await import("./endpoints");
      expect(getApiUrl()).toBe("http://localhost:4000");
    });
  });

  describe("test environment", () => {
    it("B. использует fallback на localhost:3001 при отсутствии NEXT_PUBLIC_API_URL в test", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      delete process.env.NEXT_PUBLIC_API_URL;

      const { getApiUrl } = await import("./endpoints");
      expect(getApiUrl()).toBe("http://localhost:3001");
    });

    it("B. использует заданный NEXT_PUBLIC_API_URL в test при его наличии", async () => {
      (process.env as Record<string, string | undefined>).NODE_ENV = "test";
      process.env.NEXT_PUBLIC_API_URL = "http://test-api:3001";

      const { getApiUrl } = await import("./endpoints");
      expect(getApiUrl()).toBe("http://test-api:3001");
    });
  });
});
