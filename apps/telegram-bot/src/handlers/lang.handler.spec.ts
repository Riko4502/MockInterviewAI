import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-client";
import { t } from "../i18n";
import { langCallbackHandler, langHandler } from "./lang";
import { stubHandlerContext } from "./test-context";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPatch: vi.fn(),
}));

vi.mock("../api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api-client")>();
  return { ...actual, apiGet: mocks.apiGet, apiPatch: mocks.apiPatch };
});

describe("lang.handler / langCallback (SPEC §11.5)", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPatch.mockReset();
  });

  it("/lang без аргумента → lang.select + клавиатура lang:ru/lang:en", async () => {
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await langHandler(commandCtx);

    expect(mocks.apiPatch).not.toHaveBeenCalled();
    const [, options] = reply.mock.calls[0] as [
      string,
      {
        reply_markup: {
          inline_keyboard: { text: string; callback_data: string }[][];
        };
      },
    ];
    expect(reply).toHaveBeenCalledWith(
      t("ru", "lang.select"),
      expect.anything(),
    );
    const [ruButton, enButton] = options.reply_markup.inline_keyboard[0] as [
      { text: string; callback_data: string },
      { text: string; callback_data: string },
    ];
    expect(ruButton.text).toBe(t("ru", "lang.ruLabel"));
    expect(ruButton.callback_data).toBe("lang:ru");
    expect(enButton.text).toBe(t("ru", "lang.enLabel"));
    expect(enButton.callback_data).toBe("lang:en");
  });

  it("/lang без аргумента при профильной локали en и language_code ru → клавиатура на английском", async () => {
    mocks.apiGet.mockResolvedValue({ telegramLocale: "en" });
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await langHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(
      t("en", "lang.select"),
      expect.anything(),
    );
    const [, options] = reply.mock.calls[0] as [
      string,
      {
        reply_markup: {
          inline_keyboard: { text: string; callback_data: string }[][];
        };
      },
    ];
    const [ruButton, enButton] = options.reply_markup.inline_keyboard[0] as [
      { text: string; callback_data: string },
      { text: string; callback_data: string },
    ];
    expect(ruButton.text).toBe(t("en", "lang.ruLabel"));
    expect(enButton.text).toBe(t("en", "lang.enLabel"));
  });

  it("/lang ru → PATCH preferences и lang.changedRu", async () => {
    mocks.apiPatch.mockResolvedValue({ telegramLocale: "ru" });
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "en" },
      match: "ru",
    });

    await langHandler(commandCtx);

    expect(mocks.apiPatch).toHaveBeenCalledWith("/telegram/preferences", {
      chatId: "42",
      locale: "ru",
    });
    expect(commandCtx.session.locale).toBe("ru");
    expect(reply).toHaveBeenCalledWith(t("ru", "lang.changedRu"));
  });

  it("/lang en → lang.changedEn и локаль в сессию", async () => {
    mocks.apiPatch.mockResolvedValue({ telegramLocale: "en" });
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "en",
    });

    await langHandler(commandCtx);

    expect(commandCtx.session.locale).toBe("en");
    expect(reply).toHaveBeenCalledWith(t("en", "lang.changedEn"));
  });

  it("callback lang:en → PATCH, локаль в сессию, answerCallbackQuery", async () => {
    mocks.apiPatch.mockResolvedValue({ telegramLocale: "en" });
    const { ctx, reply, answerCallback } = stubHandlerContext({
      from: { language_code: "ru" },
      callbackQuery: { data: "lang:en" },
    });

    await langCallbackHandler(ctx);

    expect(mocks.apiPatch).toHaveBeenCalledWith("/telegram/preferences", {
      chatId: "42",
      locale: "en",
    });
    expect(ctx.session.locale).toBe("en");
    expect(reply).toHaveBeenCalledWith(t("en", "lang.changedEn"));
    expect(answerCallback).toHaveBeenCalledTimes(1);
  });

  it("callback с неизвестными данными → без вызова API", async () => {
    const { ctx, answerCallback } = stubHandlerContext({
      callbackQuery: { data: "other" },
    });

    await langCallbackHandler(ctx);

    expect(mocks.apiPatch).not.toHaveBeenCalled();
    expect(answerCallback).not.toHaveBeenCalled();
  });

  it("PATCH 404 → lang.notLinked", async () => {
    mocks.apiPatch.mockRejectedValue(
      new ApiError(404, { message: "Not found" }),
    );
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "ru",
    });

    await langHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("ru", "lang.notLinked"));
  });

  it("PATCH 404 при профильной локали en → lang.notLinked на английском", async () => {
    mocks.apiGet.mockResolvedValue({ telegramLocale: "en" });
    mocks.apiPatch.mockRejectedValue(
      new ApiError(404, { message: "Not found" }),
    );
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "ru",
    });

    await langHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("en", "lang.notLinked"));
  });

  it("PATCH 5xx → lang.persistError", async () => {
    mocks.apiPatch.mockRejectedValue(
      new ApiError(500, { message: "Internal" }),
    );
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "ru",
    });

    await langHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("ru", "lang.persistError"));
  });

  it("непредвиденная ошибка → lang.persistError", async () => {
    mocks.apiPatch.mockRejectedValue(new Error("boom"));
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "ru",
    });

    await langHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("ru", "lang.persistError"));
  });
});
