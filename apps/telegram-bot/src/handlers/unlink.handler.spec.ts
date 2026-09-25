import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-client";
import { t } from "../i18n";
import { stubHandlerContext } from "./test-context";
import { unlinkHandler } from "./unlink";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock("../api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api-client")>();
  return { ...actual, apiGet: mocks.apiGet, apiPost: mocks.apiPost };
});

describe("unlink.handler (SPEC §11.4)", () => {
  beforeEach(() => {
    mocks.apiGet.mockReset();
    mocks.apiPost.mockReset();
  });

  it("успех → unlink.success", async () => {
    mocks.apiPost.mockResolvedValue({ success: true });
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await unlinkHandler(ctx);

    expect(mocks.apiPost).toHaveBeenCalledWith("/telegram/unlink", {
      chatId: "42",
    });
    expect(reply).toHaveBeenCalledWith(t("ru", "unlink.success"));
  });

  it("профильная локаль en при language_code ru → unlink.success на английском", async () => {
    mocks.apiGet.mockResolvedValue({ telegramLocale: "en" });
    mocks.apiPost.mockResolvedValue({ success: true });
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await unlinkHandler(ctx);

    expect(reply).toHaveBeenCalledWith(t("en", "unlink.success"));
  });

  it("404 → unlink.notLinked", async () => {
    mocks.apiPost.mockRejectedValue(
      new ApiError(404, { message: "Not linked" }),
    );
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "en" },
    });

    await unlinkHandler(ctx);

    expect(reply).toHaveBeenCalledWith(t("en", "unlink.notLinked"));
  });

  it("5xx → unlink.unexpected", async () => {
    mocks.apiPost.mockRejectedValue(new ApiError(500, { message: "Internal" }));
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await unlinkHandler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "unlink.unexpected"));
  });

  it("непредвиденная ошибка → errors.unexpected", async () => {
    mocks.apiPost.mockRejectedValue(new Error("boom"));
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await unlinkHandler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "errors.unexpected"));
  });
});
