import { describe, expect, it } from "vitest";
import { telegramAuthSchema, telegramCompleteSchema } from "./telegram.dto";

describe("telegramAuthSchema", () => {
  it("успешно валидирует корректный payload от Telegram", () => {
    const input = {
      id: 123456789,
      first_name: "John",
      username: "john_doe",
      auth_date: 1700000000,
      hash: "abcdef1234567890",
    };
    const result = telegramAuthSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("приводит строковые id и auth_date к числам", () => {
    const input = {
      id: "123456789",
      auth_date: "1700000000",
      hash: "abcdef1234567890",
    };
    const result = telegramAuthSchema.parse(input);
    expect(result.id).toBe(123456789);
    expect(result.auth_date).toBe(1700000000);
  });
});

describe("telegramCompleteSchema", () => {
  it("нормализует email при завершении регистрации", () => {
    const input = {
      onboardingToken: "valid_token_123",
      email: "  Test.User@Example.COM  ",
    };
    const result = telegramCompleteSchema.parse(input);
    expect(result.email).toBe("test.user@example.com");
  });
});
