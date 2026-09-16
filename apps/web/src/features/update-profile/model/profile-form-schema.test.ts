import { describe, expect, it } from "vitest";
import { profileFormSchema, toUpdateProfileDto } from "./profile-form-schema";

describe("profileFormSchema", () => {
  it("принимает валидные поля и нормализует пустые опциональные значения", () => {
    const parsed = profileFormSchema.parse({
      displayName: "  Иван  ",
      username: "Ivan_Dev",
      telegramUsername: " @ivan_dev ",
      gitUrl: "https://github.com/ivan",
    });

    expect(toUpdateProfileDto(parsed)).toEqual({
      displayName: "Иван",
      username: "ivan_dev",
      telegramUsername: "ivan_dev",
      gitUrl: "https://github.com/ivan",
    });
  });

  it("отправляет null, если telegram и git не заполнены", () => {
    const parsed = profileFormSchema.parse({
      displayName: "Иван",
      username: "ivan",
      telegramUsername: "  ",
      gitUrl: "",
    });

    expect(toUpdateProfileDto(parsed)).toEqual({
      displayName: "Иван",
      username: "ivan",
      telegramUsername: null,
      gitUrl: null,
    });
  });

  it("отклоняет слишком короткое отображаемое имя", () => {
    const result = profileFormSchema.safeParse({
      displayName: "И",
      username: "ivan",
      telegramUsername: "",
      gitUrl: "",
    });

    expect(result.success).toBe(false);
  });
});
