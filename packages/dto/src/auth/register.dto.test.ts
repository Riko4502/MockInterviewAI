import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";
import { registerSchema } from "./register.dto";

const VALID_PASSWORD = "a".repeat(PASSWORD_MIN_LENGTH);

describe("registerSchema", () => {
  describe("успешная валидация", () => {
    it("корректный email и пароль", () => {
      const result = registerSchema.parse({
        email: "user@example.com",
        password: VALID_PASSWORD,
      });
      expect(result).toEqual({
        email: "user@example.com",
        password: VALID_PASSWORD,
      });
    });

    it("пароль ровно MAX_LENGTH символов", () => {
      const result = registerSchema.parse({
        email: "user@example.com",
        password: "a".repeat(PASSWORD_MAX_LENGTH),
      });
      expect(result.password).toHaveLength(PASSWORD_MAX_LENGTH);
    });
  });

  describe("нормализация email", () => {
    it("lowercase email", () => {
      const result = registerSchema.parse({
        email: "USER@EXAMPLE.COM",
        password: VALID_PASSWORD,
      });
      expect(result.email).toBe("user@example.com");
    });

    it("trim + lowercase email", () => {
      const result = registerSchema.parse({
        email: "  USER@EXAMPLE.COM  ",
        password: VALID_PASSWORD,
      });
      expect(result.email).toBe("user@example.com");
    });

    it("trim убирает пробелы → пустой email отклоняется", () => {
      const r = registerSchema.safeParse({
        email: "   ",
        password: VALID_PASSWORD,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Email is required");
      }
    });
  });

  describe("ошибки email", () => {
    it("пустой email", () => {
      const r = registerSchema.safeParse({
        email: "",
        password: VALID_PASSWORD,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Email is required");
      }
    });

    it("некорректный формат", () => {
      const r = registerSchema.safeParse({
        email: "not-an-email",
        password: VALID_PASSWORD,
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Invalid email format");
      }
    });
  });

  describe("ошибки пароля", () => {
    it("пароль короче MIN_LENGTH", () => {
      const r = registerSchema.safeParse({
        email: "user@example.com",
        password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
        );
      }
    });

    it("пароль длиннее MAX_LENGTH", () => {
      const r = registerSchema.safeParse({
        email: "user@example.com",
        password: "a".repeat(PASSWORD_MAX_LENGTH + 1),
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
        );
      }
    });
  });

  describe("некорректные типы", () => {
    it("email — число", () => {
      const r = registerSchema.safeParse({
        email: 123,
        password: VALID_PASSWORD,
      });
      expect(r.success).toBe(false);
    });

    it("password — число", () => {
      const r = registerSchema.safeParse({
        email: "user@example.com",
        password: 123,
      });
      expect(r.success).toBe(false);
    });

    it("пустой объект", () => {
      const r = registerSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });
});
