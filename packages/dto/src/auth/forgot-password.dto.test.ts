import { describe, expect, it } from "vitest";
import { forgotPasswordSchema } from "./forgot-password.dto";

describe("forgotPasswordSchema", () => {
  describe("успешная валидация", () => {
    it("корректный email", () => {
      const result = forgotPasswordSchema.parse({
        email: "user@example.com",
      });
      expect(result).toEqual({
        email: "user@example.com",
      });
    });

    it("нормализация email: lowercase + trim", () => {
      const result = forgotPasswordSchema.parse({
        email: "  USER@EXAMPLE.COM  ",
      });
      expect(result.email).toBe("user@example.com");
    });
  });

  describe("ошибки валидации", () => {
    it("пустой email → ошибка", () => {
      const r = forgotPasswordSchema.safeParse({
        email: "",
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Email обязателен");
      }
    });

    it("пробелы вместо email → ошибка", () => {
      const r = forgotPasswordSchema.safeParse({
        email: "   ",
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Email обязателен");
      }
    });

    it("некорректный формат email → ошибка", () => {
      const r = forgotPasswordSchema.safeParse({
        email: "invalid-email",
      });
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Некорректный email");
      }
    });

    it("отсутствие email → ошибка", () => {
      const r = forgotPasswordSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });
});
