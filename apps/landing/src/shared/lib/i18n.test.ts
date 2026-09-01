import { defaultLocale, getMessages, locales } from "@packages/i18n";
import { describe, expect, it } from "vitest";
import i18n from "./i18n";

describe("i18n configuration", () => {
  it("should initialize i18next with default locale and namespaces", () => {
    expect(i18n.isInitialized).toBe(true);
    expect(i18n.language).toBe(defaultLocale);
    expect(locales).toContain("ru");
    expect(locales).toContain("en");
  });

  it("should provide valid landing translations for all supported locales", () => {
    for (const locale of locales) {
      const messages = getMessages(locale);
      expect(messages.landing).toBeDefined();
      expect(messages.landing.hero.title1).toBeTruthy();
      expect(messages.landing.nav.howItWorks).toBeTruthy();
    }
  });
});
