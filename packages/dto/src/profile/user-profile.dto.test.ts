import { describe, expect, it } from "vitest";
import { publicUserProfileSchema, userProfileSchema } from "./user-profile.dto";

describe("userProfileSchema and publicUserProfileSchema", () => {
  const validProfile = {
    id: "123e4567-e89b-12d3-a456-426614174000",
    displayName: "John Doe",
    username: "johndoe",
    avatarUrl: "https://example.com/avatar.png",
    telegramUsername: "johndoe_tg",
    gitUrl: "https://github.com/johndoe",
    createdAt: "2026-08-01T00:00:00.000Z",
    email: "john@example.com",
    role: "USER",
    permissions: "0",
    theme: "dark",
    locale: "ru",
    updatedAt: "2026-08-02T00:00:00.000Z",
  };

  it("успешно валидирует полный профиль с ISO-строками дат", () => {
    const result = userProfileSchema.safeParse(validProfile);
    expect(result.success).toBe(true);
  });

  it("успешно валидирует публичный профиль", () => {
    const { email, role, permissions, updatedAt, ...publicData } = validProfile;
    const result = publicUserProfileSchema.safeParse(publicData);
    expect(result.success).toBe(true);
  });

  it("отклоняет профиль с не-ISO форматом даты", () => {
    const invalidProfile = {
      ...validProfile,
      createdAt: "invalid-date",
    };
    const result = userProfileSchema.safeParse(invalidProfile);
    expect(result.success).toBe(false);
  });
});
