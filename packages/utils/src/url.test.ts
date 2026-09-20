import { describe, expect, it } from "vitest";
import { buildUrl, buildUrlWithOptions } from "./url";

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

  it("поддерживает расширенные опции с params и hash через buildUrlWithOptions", () => {
    const url = buildUrlWithOptions("https://example.com", "/docs", {
      params: { page: 2 },
      hash: "#section-1",
    });
    expect(url).toBe("https://example.com/docs?page=2#section-1");
  });

  it("не теряет параметры запроса и сериализует hash как query-параметр в buildUrl", () => {
    const url = buildUrl("https://example.com", "/sandbox", {
      hash: "abc",
      room: "1",
    });
    expect(url).toBe("https://example.com/sandbox?hash=abc&room=1");
  });

  it("корректно сериализует query-параметр с именем params, если он является примитивом или массивом", () => {
    const urlString = buildUrl("https://example.com", "/search", {
      params: "filter-value",
      sort: "asc",
    });
    expect(urlString).toBe(
      "https://example.com/search?params=filter-value&sort=asc",
    );

    const urlArray = buildUrl("https://example.com", "/search", {
      params: ["a", "b"],
    });
    expect(urlArray).toBe("https://example.com/search?params=a&params=b");
  });

  describe("regression: одиночный ключ hash в QueryParamsRecord", () => {
    it("трактует одиночный hash со строковым значением как query-параметр", () => {
      const url = buildUrl("https://example.com", "/api/commit", {
        hash: "a1b2c3d4e5",
      });
      expect(url).toBe("https://example.com/api/commit?hash=a1b2c3d4e5");
    });

    it("трактует одиночный hash с boolean значением как query-параметр без выброса TypeError", () => {
      const urlTrue = buildUrl("https://example.com", "/search", {
        hash: true,
      });
      expect(urlTrue).toBe("https://example.com/search?hash=true");

      const urlFalse = buildUrl("https://example.com", "/search", {
        hash: false,
      });
      expect(urlFalse).toBe("https://example.com/search?hash=false");
    });

    it("трактует одиночный hash с массивом как query-параметр без вызова startsWith() и падения", () => {
      const url = buildUrl("https://example.com", "/search", {
        hash: ["a", "b"],
      });
      expect(url).toBe("https://example.com/search?hash=a&hash=b");
    });

    it("трактует одиночный hash с числовым значением как query-параметр", () => {
      const url = buildUrl("https://example.com", "/search", {
        hash: 42,
      });
      expect(url).toBe("https://example.com/search?hash=42");
    });
  });

  describe("buildUrlWithOptions", () => {
    it("явно строит URL с фрагментом hash", () => {
      const url = buildUrlWithOptions("https://example.com", "/docs", {
        hash: "overview",
      });
      expect(url).toBe("https://example.com/docs#overview");

      const urlWithPrefix = buildUrlWithOptions(
        "https://example.com",
        "/docs",
        {
          hash: "#overview",
        },
      );
      expect(urlWithPrefix).toBe("https://example.com/docs#overview");
    });

    it("поддерживает params и hash одновременно", () => {
      const url = buildUrlWithOptions("https://example.com", "/docs", {
        params: { lang: "ru", tab: "faq" },
        hash: "#contacts",
      });
      expect(url).toBe("https://example.com/docs?lang=ru&tab=faq#contacts");
    });

    it("корректно работает при вызове без options", () => {
      expect(buildUrlWithOptions("https://example.com", "/docs")).toBe(
        "https://example.com/docs",
      );
    });

    it("безопасно обрабатывает нестроковый hash при рантайм-вызове без выброса TypeError", () => {
      const url = buildUrlWithOptions("https://example.com", "/docs", {
        hash: ["a", "b"] as unknown as string,
      });
      expect(url).toBe("https://example.com/docs");
    });
  });
});
