import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProfileLocale, resolveLocale, t } from "./i18n";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock("./api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./api-client")>();
  return { ...actual, apiGet: mocks.apiGet };
});

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

describe("getProfileLocale (SPEC §10.2, п.2)", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
  });

  it("валидная локаль профиля → возвращает её", async () => {
    mocks.apiGet.mockResolvedValue({ telegramLocale: "en" });

    await expect(getProfileLocale("42")).resolves.toBe("en");
    expect(mocks.apiGet).toHaveBeenCalledWith("/telegram/profile", {
      chatId: "42",
    });
  });

  it("telegramLocale null (не задан) → undefined", async () => {
    mocks.apiGet.mockResolvedValue({ telegramLocale: null });

    await expect(getProfileLocale("42")).resolves.toBeUndefined();
  });

  it("404 (не привязан) → undefined", async () => {
    mocks.apiGet.mockRejectedValue(
      new Error("API request failed with status 404"),
    );

    await expect(getProfileLocale("42")).resolves.toBeUndefined();
  });

  it("прочие ошибки (5xx/сеть) → undefined", async () => {
    mocks.apiGet.mockRejectedValue(new Error("connection refused"));

    await expect(getProfileLocale("42")).resolves.toBeUndefined();
  });
});
