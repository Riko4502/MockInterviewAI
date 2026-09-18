import { describe, expect, it } from "vitest";
import { buildUrl } from "./url";

describe("buildUrl", () => {
  it("нормализует слеши между baseUrl и pathname", () => {
    expect(buildUrl("https://example.com/", "/dashboard/sandbox")).toBe(
      "https://example.com/dashboard/sandbox",
    );
    expect(buildUrl("https://example.com", "dashboard/sandbox")).toBe(
      "https://example.com/dashboard/sandbox",
    );
    expect(buildUrl("https://example.com///", "///dashboard/sandbox")).toBe(
      "https://example.com/dashboard/sandbox",
    );
  });

  it("корректно добавляет параметры запроса", () => {
    const url = buildUrl("https://example.com", "/sandbox", {
      room: "123",
      invite: "token-abc",
    });
    expect(url).toBe("https://example.com/sandbox?room=123&invite=token-abc");
  });

  it("игнорирует undefined, null и пустые строки", () => {
    const url = buildUrl("https://example.com", "/sandbox", {
      room: "123",
      empty: "",
      nil: null,
      undef: undefined,
    });
    expect(url).toBe("https://example.com/sandbox?room=123");
  });

  it("поддерживает массивы параметров", () => {
    const url = buildUrl("https://example.com", "/search", {
      tags: ["react", "vue"],
    });
    expect(url).toBe("https://example.com/search?tags=react&tags=vue");
  });

  it("поддерживает расширенные опции с hash", () => {
    const url = buildUrl("https://example.com", "/docs", {
      params: { page: 2 },
      hash: "#section-1",
    });
    expect(url).toBe("https://example.com/docs?page=2#section-1");
  });
});
