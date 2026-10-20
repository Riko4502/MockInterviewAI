import { describe, expect, it } from "vitest";
import {
  createProfileFormSchema,
  toUpdateProfileDto,
} from "./profile-form-schema";

const schema = createProfileFormSchema((key) => key);

describe("createProfileFormSchema", () => {
  it("принимает валидные поля и нормализует пустые опциональные значения", () => {
    const parsed = schema.parse({
      displayName: "  Иван  ",
      username: "Ivan_Dev",
      telegramUsername: " @ivan_dev ",
      gitUrl: "https://github.com/ivan",
      theme: "dark",
      locale: "ru",
      timezone: " Europe/Moscow ",
    });

    expect(toUpdateProfileDto(parsed)).toEqual({
      displayName: "Иван",
      username: "ivan_dev",
      telegramUsername: "ivan_dev",
      gitUrl: "https://github.com/ivan",
      theme: "dark",
      locale: "ru",
      timezone: "Europe/Moscow",
    });
  });

  it("отправляет null, если telegram и git не заполнены", () => {
    const parsed = schema.parse({
      displayName: "Иван",
      username: "ivan",
      telegramUsername: "  ",
      gitUrl: "",
      theme: "light",
      locale: "en",
      timezone: "UTC",
    });

    expect(toUpdateProfileDto(parsed)).toEqual({
      displayName: "Иван",
      username: "ivan",
      telegramUsername: null,
      gitUrl: null,
      theme: "light",
      locale: "en",
      timezone: "UTC",
    });
  });

  it("отправляет только измененные поля, если переданы dirtyFields", () => {
    const parsed = schema.parse({
      displayName: "Иван",
      username: "ivan",
      telegramUsername: "",
      gitUrl: "",
      theme: "dark",
      locale: "ru",
      timezone: "UTC",
    });

    expect(toUpdateProfileDto(parsed, { displayName: true })).toEqual({
      displayName: "Иван",
    });

    expect(toUpdateProfileDto(parsed, { theme: true })).toEqual({
      theme: "dark",
    });

    expect(toUpdateProfileDto(parsed, { timezone: true })).toEqual({
      timezone: "UTC",
    });

    expect(toUpdateProfileDto(parsed, {})).toEqual({});
  });

  it("отклоняет невалидную IANA-таймзону", () => {
    const result = schema.safeParse({
      displayName: "Иван",
      username: "ivan",
      telegramUsername: "",
      gitUrl: "",
      theme: "dark",
      locale: "ru",
      timezone: "+04:00",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("profile.errors.timezone");
    }
  });

  it("отклоняет слишком короткое отображаемое имя", () => {
    const result = schema.safeParse({
      displayName: "И",
      username: "ivan",
      telegramUsername: "",
      gitUrl: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "profile.errors.displayNameMin",
      );
    }
  });
});
