import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppUrl, buildAppUrlWithOptions, getAppUrl } from "./url";

describe("url helpers", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("getAppUrl", () => {
    it("возвращает NEXT_PUBLIC_APP_URL если он задан", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://mockinterview.ai/";
      expect(getAppUrl()).toBe("https://mockinterview.ai");
    });

    it("возвращает window.location.origin в браузере при отсутствии переменной окружения", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      expect(getAppUrl()).toBe(window.location.origin);
    });

    it("fallback на http://localhost:3000 в SSR/Node окружении при отсутствии window и переменной", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      vi.stubGlobal("window", undefined);
      expect(getAppUrl()).toBe("http://localhost:3000");
    });
  });

  describe("buildAppUrl", () => {
    it("формирует абсолютную ссылку с query-параметрами", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.mockinterview.ai";
      const url = buildAppUrl("/dashboard/sandbox", {
        room: "uuid-123",
        invite: "token-abc",
      });

      expect(url).toBe(
        "https://app.mockinterview.ai/dashboard/sandbox?room=uuid-123&invite=token-abc",
      );
    });

    describe("regression: одиночный ключ hash в QueryParamsRecord", () => {
      it("трактует одиночный hash со строковым значением как query-параметр", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://app.mockinterview.ai";
        const url = buildAppUrl("/search", { hash: "test-hash" });
        expect(url).toBe("https://app.mockinterview.ai/search?hash=test-hash");
      });

      it("трактует одиночный hash со значением boolean как query-параметр без ошибок", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://app.mockinterview.ai";
        const url = buildAppUrl("/search", { hash: true });
        expect(url).toBe("https://app.mockinterview.ai/search?hash=true");
      });

      it("трактует одиночный hash с массивом как query-параметр без падения на startsWith()", () => {
        process.env.NEXT_PUBLIC_APP_URL = "https://app.mockinterview.ai";
        const url = buildAppUrl("/search", { hash: ["a", "b"] });
        expect(url).toBe("https://app.mockinterview.ai/search?hash=a&hash=b");
      });
    });
  });

  describe("buildAppUrlWithOptions", () => {
    it("формирует абсолютную ссылку с hash-фрагментом для безопасной передачи инвайта (CWE-598)", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.mockinterview.ai";
      const url = buildAppUrlWithOptions("/dashboard/sandbox", {
        params: { room: "uuid-123" },
        hash: "invite=token-abc",
      });

      expect(url).toBe(
        "https://app.mockinterview.ai/dashboard/sandbox?room=uuid-123#invite=token-abc",
      );
    });

    it("строит URL с hash-фрагментом без params", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://app.mockinterview.ai";
      const url = buildAppUrlWithOptions("/docs", {
        hash: "features",
      });
      expect(url).toBe("https://app.mockinterview.ai/docs#features");
    });
  });
});
