import { SECURITY_UNLINK_ERROR_CODES } from "@packages/dto";
import { describe, expect, it } from "vitest";
import { HttpError } from "@/shared/api";
import { getUnlinkErrorKey, isCodeInvalidatingError } from "./unlink-error";

/** Собирает ошибку в форме транспорта: тело `{ code }` + HTTP-статус. */
function unlinkError(code: string, status = 400): HttpError {
  return new HttpError("Unlink failed", status, {
    code,
    message: "Unlink failed",
  });
}

describe("getUnlinkErrorKey", () => {
  it("мапит коды ошибок Telegram на i18n-ключи (F7)", () => {
    expect(
      getUnlinkErrorKey(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.INVALID_CODE),
        "telegram",
      ),
    ).toBe("profile.telegramUnlinkErrorInvalidCode");

    expect(
      getUnlinkErrorKey(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED, 410),
        "telegram",
      ),
    ).toBe("profile.telegramUnlinkErrorExpired");

    expect(
      getUnlinkErrorKey(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.ATTEMPTS_EXCEEDED, 429),
        "telegram",
      ),
    ).toBe("profile.telegramUnlinkErrorAttempts");

    expect(
      getUnlinkErrorKey(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.ALREADY_UNLINKED, 409),
        "telegram",
      ),
    ).toBe("profile.telegramUnlinkErrorAlreadyUnlinked");
  });

  it("мапит отвязку последнего способа входа на текст про последний метод (D9)", () => {
    expect(
      getUnlinkErrorKey(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.LAST_AUTH_METHOD, 409),
        "github",
      ),
    ).toBe("profile.githubUnlinkErrorLastMethod");
  });

  it("отдаёт generic-текст для «не привязано» и признаёт rate limit по статусу 429", () => {
    expect(
      getUnlinkErrorKey(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.TELEGRAM_NOT_LINKED, 400),
        "telegram",
      ),
    ).toBe("profile.telegramUnlinkErrorGeneric");

    expect(
      getUnlinkErrorKey(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.GITHUB_NOT_LINKED, 400),
        "github",
      ),
    ).toBe("profile.githubUnlinkErrorGeneric");

    // ThrottlerGuard отдаёт 429 без машиночитаемого кода.
    expect(getUnlinkErrorKey(unlinkError("", 429), "telegram")).toBe(
      "profile.telegramUnlinkErrorRateLimited",
    );
  });

  it("возвращает generic-текст для неизвестной ошибки и для не-объекта", () => {
    expect(getUnlinkErrorKey(new Error("boom"), "telegram")).toBe(
      "profile.telegramUnlinkErrorGeneric",
    );
    expect(getUnlinkErrorKey(null, "github")).toBe(
      "profile.githubUnlinkErrorGeneric",
    );
    expect(getUnlinkErrorKey(undefined, "telegram")).toBe(
      "profile.telegramUnlinkErrorGeneric",
    );
  });
});

describe("isCodeInvalidatingError", () => {
  it("считает инвалидирующими только истечение TTL и лимит попыток", () => {
    expect(
      isCodeInvalidatingError(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.CODE_EXPIRED, 410),
      ),
    ).toBe(true);
    expect(
      isCodeInvalidatingError(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.ATTEMPTS_EXCEEDED, 429),
      ),
    ).toBe(true);
  });

  it("не считает инвалидирующей одиночную ошибку неверного кода", () => {
    expect(
      isCodeInvalidatingError(
        unlinkError(SECURITY_UNLINK_ERROR_CODES.INVALID_CODE),
      ),
    ).toBe(false);
    expect(isCodeInvalidatingError(new Error("boom"))).toBe(false);
  });
});
