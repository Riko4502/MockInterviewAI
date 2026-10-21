import { describe, expect, it } from "vitest";

import {
  confirmTelegramUnlinkSchema,
  SECURITY_UNLINK_ERROR_CODES,
  securityUnlinkResponseSchema,
  telegramUnlinkRequestResponseSchema,
} from "./unlink.dto";

describe("confirmTelegramUnlinkSchema", () => {
  it("принимает шестизначный код и тримит пробелы", () => {
    const result = confirmTelegramUnlinkSchema.safeParse({ code: " 123456 " });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.code).toBe("123456");
    }
  });

  it.each([
    "12345",
    "1234567",
    "12345a",
    "",
    "abcdef",
    "123 456",
  ])("отклоняет код %j", (code) => {
    expect(confirmTelegramUnlinkSchema.safeParse({ code }).success).toBe(false);
  });

  it("сообщение об ошибке не подсказывает верный формат сверх шести цифр", () => {
    const result = confirmTelegramUnlinkSchema.safeParse({ code: "12345" });
    expect(result.success).toBe(false);
    // Ошибка формулируется как «6 цифр», а не как «код неверный»: сервис
    // различает неверный код отдельным `code` в теле ответа (D4).
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Код должен состоять из 6 цифр",
      );
    }
  });
});

describe("telegramUnlinkRequestResponseSchema", () => {
  it("принимает успешный ответ с ISO-временем", () => {
    const result = telegramUnlinkRequestResponseSchema.safeParse({
      sent: true,
      expiresAt: "2026-10-01T09:10:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("отклоняет sent: false и не-ISO время", () => {
    expect(
      telegramUnlinkRequestResponseSchema.safeParse({
        sent: false,
        expiresAt: "2026-10-01T09:10:00.000Z",
      }).success,
    ).toBe(false);
    expect(
      telegramUnlinkRequestResponseSchema.safeParse({
        sent: true,
        expiresAt: "not-a-date",
      }).success,
    ).toBe(false);
  });
});

describe("securityUnlinkResponseSchema", () => {
  it("принимает только success: true", () => {
    expect(
      securityUnlinkResponseSchema.safeParse({ success: true }).success,
    ).toBe(true);
    expect(
      securityUnlinkResponseSchema.safeParse({ success: false }).success,
    ).toBe(false);
  });
});

describe("SECURITY_UNLINK_ERROR_CODES", () => {
  it("ключи совпадают со значениями — фронт мапит код без разбора текста", () => {
    for (const [key, value] of Object.entries(SECURITY_UNLINK_ERROR_CODES)) {
      expect(key).toBe(value);
    }
  });

  it("покрывает контракт D4", () => {
    expect(Object.values(SECURITY_UNLINK_ERROR_CODES).sort()).toEqual([
      "ALREADY_UNLINKED",
      "ATTEMPTS_EXCEEDED",
      "CODE_EXPIRED",
      "GITHUB_NOT_LINKED",
      "INVALID_CODE",
      "LAST_AUTH_METHOD",
      "TELEGRAM_NOT_LINKED",
    ]);
  });
});
