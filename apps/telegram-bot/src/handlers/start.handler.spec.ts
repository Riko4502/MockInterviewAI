import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-client";
import { t } from "../i18n";
import { startHandler } from "./start";
import { stubHandlerContext } from "./test-context";

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
}));

vi.mock("../api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api-client")>();
  return { ...actual, apiPost: mocks.apiPost };
});

describe("start.handler (SPEC §6.3, §11.1)", () => {
  beforeEach(() => {
    mocks.apiPost.mockReset();
  });

  it("без токена — приветствие start.welcome без вызова API", async () => {
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await startHandler(commandCtx);

    expect(mocks.apiPost).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(t("ru", "start.welcome"));
  });

  it("не-приватный чат — только приветствие, привязка не выполняется", async () => {
    const { commandCtx, reply } = stubHandlerContext({
      chat: { id: -1001234, type: "group" },
      from: { language_code: "en" },
    });

    await startHandler(commandCtx);

    expect(mocks.apiPost).not.toHaveBeenCalled();
    expect(reply).toHaveBeenCalledWith(t("en", "start.welcome"));
  });

  it("успех привязки → start.linked + start.linkedHint на языке профиля, без записи локали в сессию", async () => {
    mocks.apiPost.mockResolvedValue({ telegramLocale: "en" });
    const { commandCtx, reply } = stubHandlerContext({
      chat: { id: 42, type: "private" },
      from: { language_code: "ru" },
      match: "rawToken",
    });

    await startHandler(commandCtx);

    expect(mocks.apiPost).toHaveBeenCalledWith("/telegram/link", {
      token: "rawToken",
      chatId: "42",
    });
    expect(commandCtx.session.locale).toBeUndefined();
    expect(reply).toHaveBeenNthCalledWith(1, t("en", "start.linked"));
    expect(reply).toHaveBeenNthCalledWith(2, t("en", "start.linkedHint"));
  });

  it("409 → start.alreadyLinked", async () => {
    mocks.apiPost.mockRejectedValue(
      new ApiError(409, { message: "Already linked" }),
    );
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "token",
    });

    await startHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("ru", "start.alreadyLinked"));
  });

  it("410 → start.tokenExpired", async () => {
    mocks.apiPost.mockRejectedValue(
      new ApiError(410, { message: "Token expired" }),
    );
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "en" },
      match: "token",
    });

    await startHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("en", "start.tokenExpired"));
  });

  it("400 → start.linkError", async () => {
    mocks.apiPost.mockRejectedValue(new ApiError(400, { message: "Bad" }));
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "token",
    });

    await startHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("ru", "start.linkError"));
  });

  it("5xx → start.linkError", async () => {
    mocks.apiPost.mockRejectedValue(new ApiError(500, { message: "Internal" }));
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "token",
    });

    await startHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("ru", "start.linkError"));
  });

  it("непредвиденная ошибка → errors.unexpected", async () => {
    mocks.apiPost.mockRejectedValue(new Error("boom"));
    const { commandCtx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
      match: "token",
    });

    await startHandler(commandCtx);

    expect(reply).toHaveBeenCalledWith(t("ru", "errors.unexpected"));
  });
});
