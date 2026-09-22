import { describe, expect, it } from "vitest";
import { userAdminResponseSchema } from "./user-admin-response.dto";

describe("userAdminResponseSchema", () => {
  const validUser = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    email: "user@example.com",
    username: "testuser",
    displayName: "Test User",
    role: "USER",
    isActive: true,
    deactivatedAt: null,
    deletedAt: null,
    avatarUrl: null,
    telegramUsername: null,
    gitUrl: null,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt: "2026-08-01T12:00:00.000Z",
  };

  it("успешно валидирует корректный объект пользователя с ISO-датами", () => {
    const result = userAdminResponseSchema.safeParse(validUser);
    expect(result.success).toBe(true);
  });

  it("валидирует пользователя с непустым deactivatedAt (ISO-строка)", () => {
    const result = userAdminResponseSchema.safeParse({
      ...validUser,
      isActive: false,
      deactivatedAt: "2026-09-01T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("валидирует пользователя с непустым deletedAt (ISO-строка)", () => {
    const result = userAdminResponseSchema.safeParse({
      ...validUser,
      deletedAt: "2026-09-02T15:30:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("отклоняет невалидный формат дат (не ISO datetime)", () => {
    const invalidDateUser = {
      ...validUser,
      createdAt: "not-a-date",
    };
    const result = userAdminResponseSchema.safeParse(invalidDateUser);
    expect(result.success).toBe(false);
  });
});
