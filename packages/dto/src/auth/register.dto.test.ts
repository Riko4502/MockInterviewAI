import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";
import { registerSchema } from "./register.dto";

const VALID_PASSWORD = "a".repeat(PASSWORD_MIN_LENGTH);

function validInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    email: "user@example.com",
    password: VALID_PASSWORD,
    passwordConfirmation: VALID_PASSWORD,
    ...overrides,
  };
}

describe("registerSchema", () => {
  describe("успешная валидация", () => {
    it("корректный email и совпадающие пароли", () => {
      const result = registerSchema.parse(validInput());
      expect(result).toEqual({
        email: "user@example.com",
        password: VALID_PASSWORD,
      });
    });

    it("passwordConfirmation удаляется из результата парсинга (§5)", () => {
      const result = registerSchema.parse(validInput());
      expect(result).not.toHaveProperty("passwordConfirmation");
    });

    it("пароль ровно MAX_LENGTH символов", () => {
      const longPassword = "a".repeat(PASSWORD_MAX_LENGTH);
      const result = registerSchema.parse(
        validInput({
          password: longPassword,
          passwordConfirmation: longPassword,
        }),
      );
      expect(result.password).toHaveLength(PASSWORD_MAX_LENGTH);
    });
  });

  describe("нормализация email", () => {
    it("lowercase email", () => {
      const result = registerSchema.parse(validInput());
      expect(result.email).toBe("user@example.com");
    });

    it("trim + lowercase email", () => {
      const result = registerSchema.parse(
        validInput({ email: "  USER@EXAMPLE.COM  " }),
      );
      expect(result.email).toBe("user@example.com");
    });

    it("trim убирает пробелы → пустой email отклоняется", () => {
      const r = registerSchema.safeParse(validInput({ email: "   " }));
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Email обязателен");
      }
    });
  });

  describe("ошибки email", () => {
    it("пустой email", () => {
      const r = registerSchema.safeParse(validInput({ email: "" }));
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Email обязателен");
      }
    });

    it("некорректный формат", () => {
      const r = registerSchema.safeParse(validInput({ email: "not-an-email" }));
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Некорректный email");
      }
    });
  });

  describe("ошибки пароля", () => {
    it("пароль короче MIN_LENGTH", () => {
      const r = registerSchema.safeParse(
        validInput({
          password: "a".repeat(PASSWORD_MIN_LENGTH - 1),
          passwordConfirmation: "a".repeat(PASSWORD_MIN_LENGTH - 1),
        }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`,
        );
      }
    });

    it("пароль длиннее MAX_LENGTH", () => {
      const r = registerSchema.safeParse(
        validInput({
          password: "a".repeat(PASSWORD_MAX_LENGTH + 1),
          passwordConfirmation: "b".repeat(PASSWORD_MAX_LENGTH + 1),
        }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          `Пароль должен содержать максимум ${PASSWORD_MAX_LENGTH} символов`,
        );
      }
    });
  });

  describe("passwordConfirmation (§5, §6)", () => {
    it("пустое подтверждение → «Подтверждение пароля обязательно»", () => {
      const r = registerSchema.safeParse(
        validInput({ passwordConfirmation: "" }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.issues.find(
          (i) => i.path[0] === "passwordConfirmation",
        );
        expect(issue?.message).toBe("Подтверждение пароля обязательно");
      }
    });

    it("поле отсутствует → ошибка на пути passwordConfirmation", () => {
      const input = validInput();
      delete (input as Record<string, unknown>).passwordConfirmation;
      const r = registerSchema.safeParse(input);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(
          r.error.issues.some((i) => i.path[0] === "passwordConfirmation"),
        ).toBe(true);
      }
    });

    it("mismatch → «Пароли не совпадают» на пути passwordConfirmation", () => {
      const r = registerSchema.safeParse(
        validInput({ passwordConfirmation: `${VALID_PASSWORD}x` }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.issues.find(
          (i) =>
            i.message === "Пароли не совпадают" &&
            i.path[0] === "passwordConfirmation",
        );
        expect(issue).toBeDefined();
      }
    });

    it("совпадающие пароли проходят", () => {
      const result = registerSchema.parse(validInput());
      expect(result.email).toBe("user@example.com");
    });
  });

  describe("некорректные типы", () => {
    it("email — число", () => {
      const r = registerSchema.safeParse(validInput({ email: 123 }));
      expect(r.success).toBe(false);
    });

    it("password — число", () => {
      const r = registerSchema.safeParse(validInput({ password: 123 }));
      expect(r.success).toBe(false);
    });

    it("пустой объект", () => {
      const r = registerSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });
});
