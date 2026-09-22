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

  it("отклоняет нечисловые значения для id и auth_date", () => {
    expect(
      telegramAuthSchema.safeParse({
        id: "not_a_number",
        auth_date: 1700000000,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);

    expect(
      telegramAuthSchema.safeParse({
        id: 123456789,
        auth_date: "abc",
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);

    expect(
      telegramAuthSchema.safeParse({
        id: Number.NaN,
        auth_date: 1700000000,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);
  });

  it("отклоняет отсутствие hash", () => {
    const input = {
      id: 123456789,
      auth_date: 1700000000,
    };
    const result = telegramAuthSchema.safeParse(input);
    expect(result.success).toBe(false);
  });

  it("отклоняет дробные значения для id и auth_date", () => {
    expect(
      telegramAuthSchema.safeParse({
        id: "123.45",
        auth_date: 1700000000,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);

    expect(
      telegramAuthSchema.safeParse({
        id: 123456789.5,
        auth_date: 1700000000,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);

    expect(
      telegramAuthSchema.safeParse({
        id: 123456789,
        auth_date: 1700000000.75,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);
  });

  it("отклоняет 0 и отрицательные значения для id и auth_date", () => {
    expect(
      telegramAuthSchema.safeParse({
        id: 0,
        auth_date: 1700000000,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);

    expect(
      telegramAuthSchema.safeParse({
        id: -12345,
        auth_date: 1700000000,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);

    expect(
      telegramAuthSchema.safeParse({
        id: 123456789,
        auth_date: 0,
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);

    expect(
      telegramAuthSchema.safeParse({
        id: 123456789,
        auth_date: "-1700000000",
        hash: "abcdef1234567890",
      }).success,
    ).toBe(false);
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
