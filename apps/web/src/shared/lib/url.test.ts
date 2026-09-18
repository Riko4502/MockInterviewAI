import { afterEach, describe, expect, it, vi } from "vitest";
import { buildAppUrl, getAppUrl } from "./url";

describe("url helpers", () => {
  const originalEnv = process.env.NEXT_PUBLIC_APP_URL;

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalEnv;
    vi.restoreAllMocks();
  });

  describe("getAppUrl", () => {
    it("возвращает NEXT_PUBLIC_APP_URL если он задан", () => {
      process.env.NEXT_PUBLIC_APP_URL = "https://mockinterview.ai/";
      expect(getAppUrl()).toBe("https://mockinterview.ai");
    });

    it("fallback на localhost:3000 при отсутствии window и переменной", () => {
      delete process.env.NEXT_PUBLIC_APP_URL;
      const url = getAppUrl();
      expect(url).toBeDefined();
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
  });
});
