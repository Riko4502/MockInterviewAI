import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api-client";
import { t } from "../i18n";
import type {
  Locale,
  TelegramInterviewDto,
  TelegramInterviewsListDto,
} from "../types";
import { createInterviewsHandler } from "./interviews";
import { stubHandlerContext } from "./test-context";

const mocks = vi.hoisted(() => ({
  apiGet: vi.fn(),
}));

vi.mock("../api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api-client")>();
  return { ...actual, apiGet: mocks.apiGet };
});

const WEB_APP_URL = "https://app.example.com";
const JOIN_PATH = "/dashboard/sandbox?room=";

function formatItem(locale: Locale, item: TelegramInterviewDto): string {
  const shortId = item.id.replaceAll("-", "").slice(0, 8).toUpperCase();
  return t(locale, "interviews.item", {
    shortId,
    role: t(locale, `interviews.role.${item.role.toLowerCase()}`),
    status: t(locale, `interviews.status.${item.status.toLowerCase()}`),
  });
}

const items: TelegramInterviewDto[] = [
  {
    id: "aaaa-bbbb-cccc",
    status: "ACTIVE",
    startedAt: "2026-09-17T10:00:00.000Z",
    role: "INTERVIEWER",
    createdAt: "2026-09-16T12:00:00.000Z",
  },
  {
    id: "1111-2222-3333",
    status: "CREATED",
    startedAt: null,
    role: "CANDIDATE",
    createdAt: "2026-09-15T09:00:00.000Z",
  },
];

describe("interviews.handler (SPEC §11.3)", () => {
  const handler = createInterviewsHandler(WEB_APP_URL);

  beforeEach(() => {
    mocks.apiGet.mockReset();
  });

  it("успех → title + пункты сессий + кнопки join с URL комнаты", async () => {
    mocks.apiGet.mockResolvedValue({
      items,
    } satisfies TelegramInterviewsListDto);
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await handler(ctx);

    expect(mocks.apiGet).toHaveBeenCalledWith("/telegram/interviews", {
      chatId: "42",
    });
    expect(mocks.apiGet).toHaveBeenCalledWith("/telegram/profile", {
      chatId: "42",
    });

    const body = [
      t("ru", "interviews.title"),
      ...items.map((item) => formatItem("ru", item)),
    ].join("\n");
    expect(reply).toHaveBeenCalledWith(body, expect.anything());

    const [, options] = reply.mock.calls[0] as [
      string,
      { reply_markup: { inline_keyboard: { text: string; url: string }[][] } },
    ];
    const keyboard = options.reply_markup.inline_keyboard;
    const buttons = keyboard.flat();
    expect(buttons).toHaveLength(2);
    for (const [index, item] of items.entries()) {
      const button = buttons[index] as { text: string; url: string };
      expect(button.text).toBe(t("ru", "interviews.joinButton"));
      expect(button.url).toBe(`${WEB_APP_URL}${JOIN_PATH}${item.id}`);
    }
  });

  it("профильная локаль en при language_code ru → ответ на английском (SPEC §10.2 п.2)", async () => {
    mocks.apiGet
      .mockResolvedValueOnce({ telegramLocale: "en" })
      .mockResolvedValueOnce({ items });
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await handler(ctx);

    const body = [
      t("en", "interviews.title"),
      ...items.map((item) => formatItem("en", item)),
    ].join("\n");
    expect(reply).toHaveBeenCalledWith(body, expect.anything());
    expect(reply).not.toHaveBeenCalledWith(
      t("ru", "interviews.title"),
      expect.anything(),
    );
  });

  it("пустой список → interviews.empty", async () => {
    mocks.apiGet.mockResolvedValue({ items: [] });
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "en" },
    });

    await handler(ctx);

    expect(reply).toHaveBeenCalledWith(t("en", "interviews.empty"));
  });

  it("404 → interviews.notLinked", async () => {
    mocks.apiGet.mockRejectedValue(new ApiError(404, { message: "Not found" }));
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await handler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "interviews.notLinked"));
  });

  it("5xx → interviews.unexpected", async () => {
    mocks.apiGet.mockRejectedValue(new ApiError(500, { message: "Internal" }));
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await handler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "interviews.unexpected"));
  });

  it("непредвиденная ошибка → errors.unexpected", async () => {
    mocks.apiGet.mockRejectedValue(new Error("boom"));
    const { ctx, reply } = stubHandlerContext({
      from: { language_code: "ru" },
    });

    await handler(ctx);

    expect(reply).toHaveBeenCalledWith(t("ru", "errors.unexpected"));
  });
});
