import { describe, expect, it } from "vitest";
import { telegramInterviewsListSchema } from "./interviews.dto";
import { linkRequestSchema, linkTokenResponseSchema } from "./link.dto";
import { telegramPreferencesPatchSchema } from "./preferences.dto";
import { telegramUserProfileSchema } from "./profile.dto";
import { unlinkRequestSchema, unlinkResponseSchema } from "./unlink.dto";

const VALID_CHAT_ID = "123456789";
const VALID_TOKEN = "a".repeat(48);

describe("linkRequestSchema", () => {
  it("валидный { token, chatId }", () => {
    expect(
      linkRequestSchema.parse({ token: VALID_TOKEN, chatId: VALID_CHAT_ID }),
    ).toEqual({ token: VALID_TOKEN, chatId: VALID_CHAT_ID });
  });

  it("пустой token → ошибка", () => {
    const r = linkRequestSchema.safeParse({ token: "", chatId: VALID_CHAT_ID });
    expect(r.success).toBe(false);
  });

  it("token длиннее 64 символов (лимит ?start= Telegram) → ошибка", () => {
    const r = linkRequestSchema.safeParse({
      token: "a".repeat(65),
      chatId: VALID_CHAT_ID,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toContain("64");
    }
  });

  it("chatId пустой → ошибка", () => {
    const r = linkRequestSchema.safeParse({ token: VALID_TOKEN, chatId: "" });
    expect(r.success).toBe(false);
  });

  it("chatId длиннее 32 символов → ошибка", () => {
    const r = linkRequestSchema.safeParse({
      token: VALID_TOKEN,
      chatId: "1".repeat(33),
    });
    expect(r.success).toBe(false);
  });
});

describe("linkTokenResponseSchema", () => {
  it("валидный { linkUrl }", () => {
    expect(
      linkTokenResponseSchema.parse({
        linkUrl: "https://t.me/MockInterviewBot?start=abc",
      }).linkUrl,
    ).toBe("https://t.me/MockInterviewBot?start=abc");
  });

  it("пустой linkUrl → ошибка", () => {
    const r = linkTokenResponseSchema.safeParse({ linkUrl: "" });
    expect(r.success).toBe(false);
  });
});

describe("unlinkRequestSchema", () => {
  it("валидный { chatId }", () => {
    expect(unlinkRequestSchema.parse({ chatId: VALID_CHAT_ID })).toEqual({
      chatId: VALID_CHAT_ID,
    });
  });

  it("пустой chatId → ошибка", () => {
    expect(unlinkRequestSchema.safeParse({ chatId: "" }).success).toBe(false);
  });
});

describe("unlinkResponseSchema", () => {
  it("валидный { success: true }", () => {
    expect(unlinkResponseSchema.parse({ success: true })).toEqual({
      success: true,
    });
  });

  it("success: false → ошибка", () => {
    expect(unlinkResponseSchema.safeParse({ success: false }).success).toBe(
      false,
    );
  });
});

describe("telegramUserProfileSchema", () => {
  const base = {
    id: "00000000-0000-4000-8000-000000000000",
    email: "user@example.com",
    displayName: "John Doe",
    username: "johndoe",
    telegramUsername: "@johndoe",
    telegramChatId: VALID_CHAT_ID,
    telegramLocale: "ru",
    role: "USER",
  };

  it("валидный профиль", () => {
    expect(telegramUserProfileSchema.parse(base)).toEqual(base);
  });

  it("telegramLocale: null — допустим (автоопределение)", () => {
    expect(
      telegramUserProfileSchema.parse({ ...base, telegramLocale: null })
        .telegramLocale,
    ).toBeNull();
  });

  it("невалидная локаль → ошибка", () => {
    const r = telegramUserProfileSchema.safeParse({
      ...base,
      telegramLocale: "uk",
    });
    expect(r.success).toBe(false);
  });

  it("некорректный email → ошибка", () => {
    const r = telegramUserProfileSchema.safeParse({
      ...base,
      email: "not-an-email",
    });
    expect(r.success).toBe(false);
  });
});

describe("telegramInterviewsListSchema", () => {
  it("валидный список", () => {
    const payload = {
      items: [
        {
          id: "00000000-0000-4000-8000-000000000000",
          status: "ACTIVE",
          startedAt: "2026-09-17T10:00:00.000Z",
          role: "INTERVIEWER",
          createdAt: "2026-09-16T12:00:00.000Z",
        },
      ],
    };
    expect(telegramInterviewsListSchema.parse(payload)).toEqual(payload);
  });

  it("невалидный статус → ошибка", () => {
    const r = telegramInterviewsListSchema.safeParse({
      items: [
        {
          id: "00000000-0000-4000-8000-000000000000",
          status: "ARCHIVED",
          role: "INTERVIEWER",
          createdAt: "2026-09-16T12:00:00.000Z",
        },
      ],
    });
    expect(r.success).toBe(false);
  });
});

describe("telegramPreferencesPatchSchema", () => {
  it("валидный { chatId, locale }", () => {
    expect(
      telegramPreferencesPatchSchema.parse({
        chatId: VALID_CHAT_ID,
        locale: "en",
      }),
    ).toEqual({ chatId: VALID_CHAT_ID, locale: "en" });
  });

  it("невалидная локаль → ошибка с русским сообщением", () => {
    const r = telegramPreferencesPatchSchema.safeParse({
      chatId: VALID_CHAT_ID,
      locale: "de",
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toBe("Локаль должна быть ru или en");
    }
  });
});
