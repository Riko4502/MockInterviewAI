import { defaultLocale } from "@packages/i18n";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeBrowserLocale } from "./browser-locale";

describe("normalizeBrowserLocale", () => {
  describe("Russian locale normalization", () => {
    it("нормализует точный код языка 'ru'", () => {
      expect(normalizeBrowserLocale("ru")).toBe("ru");
    });

    it("нормализует региональный код 'ru-RU'", () => {
      expect(normalizeBrowserLocale("ru-RU")).toBe("ru");
    });

    it("нормализует другие региональные варианты русского языка ('ru-BY', 'ru-KZ')", () => {
      expect(normalizeBrowserLocale("ru-BY")).toBe("ru");
      expect(normalizeBrowserLocale("ru-KZ")).toBe("ru");
    });

    it("нормализует код русского языка без учета регистра ('RU', 'ru-ru')", () => {
      expect(normalizeBrowserLocale("RU")).toBe("ru");
      expect(normalizeBrowserLocale("ru-ru")).toBe("ru");
    });
  });

  describe("English locale normalization", () => {
    it("нормализует точный код языка 'en'", () => {
      expect(normalizeBrowserLocale("en")).toBe("en");
    });

    it("нормализует региональный код 'en-US'", () => {
      expect(normalizeBrowserLocale("en-US")).toBe("en");
    });

    it("нормализует региональный код 'en-GB'", () => {
      expect(normalizeBrowserLocale("en-GB")).toBe("en");
    });

    it("нормализует другие региональные варианты английского языка ('en-CA', 'en-AU')", () => {
      expect(normalizeBrowserLocale("en-CA")).toBe("en");
      expect(normalizeBrowserLocale("en-AU")).toBe("en");
    });

    it("нормализует код английского языка без учета регистра ('EN', 'en-us')", () => {
      expect(normalizeBrowserLocale("EN")).toBe("en");
      expect(normalizeBrowserLocale("en-us")).toBe("en");
    });
  });

  describe("Unsupported locale fallback", () => {
    it("возвращает fallback 'ru' (defaultLocale) для неподдерживаемых языков ('de', 'fr', 'zh', 'es')", () => {
      expect(normalizeBrowserLocale("de")).toBe(defaultLocale);
      expect(normalizeBrowserLocale("fr-FR")).toBe(defaultLocale);
      expect(normalizeBrowserLocale("zh-CN")).toBe(defaultLocale);
      expect(normalizeBrowserLocale("es-ES")).toBe(defaultLocale);
    });
  });

  describe("Empty, undefined and invalid values handling", () => {
    it("возвращает defaultLocale для пустой строки и пробелов", () => {
      expect(normalizeBrowserLocale("")).toBe(defaultLocale);
      expect(normalizeBrowserLocale("   ")).toBe(defaultLocale);
    });

    it("возвращает defaultLocale для null параметра", () => {
      expect(normalizeBrowserLocale(null)).toBe(defaultLocale);
    });

    it("возвращает defaultLocale для undefined параметра", () => {
      expect(normalizeBrowserLocale(undefined)).toBe(defaultLocale);
    });

    it("возвращает defaultLocale для невалидных строк", () => {
      expect(normalizeBrowserLocale("123")).toBe(defaultLocale);
      expect(normalizeBrowserLocale("unknown-lang")).toBe(defaultLocale);
    });
  });

  describe("window.navigator.language integration", () => {
    const originalNavigator = globalThis.navigator;

    afterEach(() => {
      if (originalNavigator) {
        Object.defineProperty(globalThis, "navigator", {
          value: originalNavigator,
          configurable: true,
          writable: true,
        });
      }
      vi.unstubAllGlobals();
    });

    it("извлекает язык из navigator.language при вызове без аргументов", () => {
      vi.stubGlobal("navigator", { language: "en-US" });
      expect(normalizeBrowserLocale()).toBe("en");
    });

    it("возвращает 'ru' если navigator.language указывает на русский язык", () => {
      vi.stubGlobal("navigator", { language: "ru-RU" });
      expect(normalizeBrowserLocale()).toBe("ru");
    });

    it("возвращает defaultLocale ('ru') если navigator.language не поддерживается", () => {
      vi.stubGlobal("navigator", { language: "ja-JP" });
      expect(normalizeBrowserLocale()).toBe(defaultLocale);
    });

    it("возвращает defaultLocale ('ru') если navigator.language отсутствует или пустой", () => {
      vi.stubGlobal("navigator", { language: "" });
      expect(normalizeBrowserLocale()).toBe(defaultLocale);
    });
  });
});
