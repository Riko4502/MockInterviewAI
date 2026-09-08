import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("endpoints configuration", () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }

    if (originalApiUrl !== undefined) {
      process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
    } else {
      delete process.env.NEXT_PUBLIC_API_URL;
    }
    vi.unstubAllEnvs();
  });

  describe("production environment", () => {
    it("использует заданный NEXT_PUBLIC_API_URL в production", async () => {
      process.env.NODE_ENV = "production";
      process.env.NEXT_PUBLIC_API_URL = "https://api.mockinterview.com";

      const { apiUrl } = await import("./endpoints");
      expect(apiUrl).toBe("https://api.mockinterview.com");
    });

    it("выбрасывает ошибку при отсутствии NEXT_PUBLIC_API_URL в production", async () => {
      process.env.NODE_ENV = "production";
      delete process.env.NEXT_PUBLIC_API_URL;

      await expect(import("./endpoints")).rejects.toThrow();
    });
  });

  describe("development environment", () => {
    it("использует fallback на localhost:3001 при отсутствии NEXT_PUBLIC_API_URL в development", async () => {
      process.env.NODE_ENV = "development";
      delete process.env.NEXT_PUBLIC_API_URL;

      const { apiUrl } = await import("./endpoints");
      expect(apiUrl).toBe("http://localhost:3001");
    });

    it("использует заданный NEXT_PUBLIC_API_URL в development при его наличии", async () => {
      process.env.NODE_ENV = "development";
      process.env.NEXT_PUBLIC_API_URL = "http://localhost:4000";

      const { apiUrl } = await import("./endpoints");
      expect(apiUrl).toBe("http://localhost:4000");
    });
  });

  describe("test environment", () => {
    it("использует fallback на localhost:3001 при отсутствии NEXT_PUBLIC_API_URL в test", async () => {
      process.env.NODE_ENV = "test";
      delete process.env.NEXT_PUBLIC_API_URL;

      const { apiUrl } = await import("./endpoints");
      expect(apiUrl).toBe("http://localhost:3001");
    });

    it("использует заданный NEXT_PUBLIC_API_URL в test при его наличии", async () => {
      process.env.NODE_ENV = "test";
      process.env.NEXT_PUBLIC_API_URL = "http://test-api:3001";

      const { apiUrl } = await import("./endpoints");
      expect(apiUrl).toBe("http://test-api:3001");
    });
  });
});
