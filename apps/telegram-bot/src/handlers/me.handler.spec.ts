import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-client";
import { t } from "../i18n";
import type { TelegramUserProfileDto } from "../types";
import { meHandler } from "./me";
import { stubHandlerContext } from "./test-context";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock("../api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api-client")>();
  return { ...actual, apiGet: mocks.apiGet };
});

const profile: TelegramUserProfileDto = {
  id: "uuid",
  email: "user@example.com",
  displayName: "John Doe",
  username: "johndoe",
  telegramUsername: "@johndoe",
  telegramChatId: "42",
  telegramLocale: "ru",
  role: "USER",
};

describe("me.handler (SPEC §11.2)", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
  });

  it("успех → карточка профиля с переводами me.*", async () => {
    mocks.apiGet.mockResolvedValue(profile);
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await meHandler(ctx);

    expect(mocks.apiGet).toHaveBeenCalledWith("/telegram/profile", {
      chatId: "42",
    });
    const message = [
      t("ru", "me.title"),
      `${t("ru", "me.name")}: John Doe`,
      `${t("ru", "me.email")}: user@example.com`,
      `${t("ru", "me.username")}: johndoe`,
      `${t("ru", "me.telegram")}: @johndoe`,
      `${t("ru", "me.role")}: USER`,
    ].join("\n");
    expect(reply).toHaveBeenCalledWith(message);
  });

  it("пустые поля профиля выводятся как '—'", async () => {
    mocks.apiGet.mockResolvedValue({
      ...profile,
      username: null,
      telegramUsername: null,
    });
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await meHandler(ctx);

    const message = [
      t("ru", "me.title"),
      `${t("ru", "me.name")}: John Doe`,
      `${t("ru", "me.email")}: user@example.com`,
      `${t("ru", "me.username")}: —`,
      `${t("ru", "me.telegram")}: —`,
      `${t("ru", "me.role")}: USER`,
    ].join("\n");
    expect(reply).toHaveBeenCalledWith(message);
  });

  it("404 → me.notLinked", async () => {
    mocks.apiGet.mockRejectedValue(new ApiError(404, { message: "Not found" }));
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await meHandler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "me.notLinked"));
  });

  it("5xx → errors.apiUnavailable", async () => {
    mocks.apiGet.mockRejectedValue(
      new ApiError(503, { message: "Unavailable" }),
    );
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await meHandler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "errors.apiUnavailable"));
  });

  it("непредвиденная ошибка → errors.unexpected", async () => {
    mocks.apiGet.mockRejectedValue(new Error("boom"));
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await meHandler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "errors.unexpected"));
  });
});
