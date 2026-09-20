import { describe, expect, it } from "vitest";
import { resolveLocale, t } from "./i18n";

describe("resolveLocale (SPEC §10.2)", () => {
  it("приоритет: manual > profileLocale > language_code", () => {
    expect(resolveLocale("en", "ru", "ru")).toBe("en");
    expect(resolveLocale("ru", "en", "en-US")).toBe("ru");
  });

  it("manual отсутствует → локаль профиля", () => {
    expect(resolveLocale(undefined, "en", "ru")).toBe("en");
    expect(resolveLocale(undefined, "ru", "uk")).toBe("ru");
  });

  it("manual и профиль отсутствуют → автоопределение по language_code", () => {
    expect(resolveLocale(undefined, undefined, "ru")).toBe("ru");
    expect(resolveLocale(undefined, undefined, "ru-RU")).toBe("ru");
    expect(resolveLocale(undefined, undefined, "en")).toBe("en");
    expect(resolveLocale(undefined, undefined, "en-US")).toBe("en");
  });

  it("language_code отличный от ru (uk, kk) → en", () => {
    expect(resolveLocale(undefined, undefined, "uk")).toBe("en");
    expect(resolveLocale(undefined, undefined, "kk")).toBe("en");
    expect(resolveLocale(undefined, undefined, "fr")).toBe("en");
  });

  it("полностью отсутствует → fallback ru (defaultLocale)", () => {
    expect(resolveLocale()).toBe("ru");
    expect(resolveLocale(undefined, undefined, undefined)).toBe("ru");
    expect(resolveLocale(undefined, undefined, "")).toBe("ru");
  });

  it("некорректный manual/profileLocale игнорируются", () => {
    expect(resolveLocale("xx", undefined, "en")).toBe("en");
    expect(resolveLocale(undefined, "pt", "ru")).toBe("ru");
    expect(resolveLocale("br_br", "pt", undefined)).toBe("ru");
  });
});

describe("t (SPEC §10.3)", () => {
  it("возвращает перевод по точечному пути ключа", () => {
    expect(t("ru", "start.welcome")).toContain("Mock Interview AI");
    expect(t("ru", "me.notLinked")).toContain("не привязан");
    expect(t("en", "interviews.joinButton")).toBe("Join");
    expect(t("en", "errors.apiUnavailable")).toContain("unavailable");
  });

  it("возвращает вложенные ключи", () => {
    expect(t("ru", "interviews.role.candidate")).toBe("Кандидат");
    expect(t("en", "interviews.status.active")).toBe("Active");
  });

  it("отсутствующий перевод возвращается как есть (без падения)", () => {
    expect(t("ru", "start.missingKey")).toBe("start.missingKey");
    expect(t("en", "nope.deep.key")).toBe("nope.deep.key");
  });
});
