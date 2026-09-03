import { describe, expect, it } from "vitest";
import { changePasswordSchema } from "./change-password.dto";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";

const VALID_PASSWORD = "a".repeat(PASSWORD_MIN_LENGTH);

function validInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    currentPassword: "OldPassword123!",
    newPassword: VALID_PASSWORD,
    newPasswordConfirmation: VALID_PASSWORD,
    ...overrides,
  };
}

describe("changePasswordSchema", () => {
  describe("успешная валидация", () => {
    it("валидные currentPassword, newPassword и совпадающее подтверждение", () => {
      const result = changePasswordSchema.parse(validInput());
      expect(result).toEqual({
        currentPassword: "OldPassword123!",
        newPassword: VALID_PASSWORD,
      });
    });

    it("newPasswordConfirmation удаляется из результата парсинга (§5)", () => {
      const result = changePasswordSchema.parse(validInput());
      expect(result).not.toHaveProperty("newPasswordConfirmation");
    });

    it("newPassword ровно MAX_LENGTH символов", () => {
      const longPassword = "a".repeat(PASSWORD_MAX_LENGTH);
      const result = changePasswordSchema.parse(
        validInput({
          newPassword: longPassword,
          newPasswordConfirmation: longPassword,
        }),
      );
      expect(result.newPassword).toHaveLength(PASSWORD_MAX_LENGTH);
    });
  });

  describe("ошибки currentPassword", () => {
    it("пустой currentPassword → «Текущий пароль обязателен»", () => {
      const r = changePasswordSchema.safeParse(
        validInput({ currentPassword: "" }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Текущий пароль обязателен");
      }
    });

    it("currentPassword длиннее MAX_LENGTH", () => {
      const r = changePasswordSchema.safeParse(
        validInput({ currentPassword: "a".repeat(PASSWORD_MAX_LENGTH + 1) }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          `Пароль должен содержать максимум ${PASSWORD_MAX_LENGTH} символов`,
        );
      }
    });
  });

  describe("ошибки newPassword", () => {
    it("newPassword короче MIN_LENGTH", () => {
      const r = changePasswordSchema.safeParse(
        validInput({
          newPassword: "a".repeat(PASSWORD_MIN_LENGTH - 1),
          newPasswordConfirmation: "a".repeat(PASSWORD_MIN_LENGTH - 1),
        }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe(
          `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`,
        );
      }
    });

    it("newPassword длиннее MAX_LENGTH", () => {
      const r = changePasswordSchema.safeParse(
        validInput({
          newPassword: "a".repeat(PASSWORD_MAX_LENGTH + 1),
          newPasswordConfirmation: "b".repeat(PASSWORD_MAX_LENGTH + 1),
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

  describe("newPasswordConfirmation (§5, §6)", () => {
    it("пустое подтверждение → «Подтверждение пароля обязательно»", () => {
      const r = changePasswordSchema.safeParse(
        validInput({ newPasswordConfirmation: "" }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.issues.find(
          (i) => i.path[0] === "newPasswordConfirmation",
        );
        expect(issue?.message).toBe("Подтверждение пароля обязательно");
      }
    });

    it("поле отсутствует → ошибка на пути newPasswordConfirmation", () => {
      const input = validInput();
      delete (input as Record<string, unknown>).newPasswordConfirmation;
      const r = changePasswordSchema.safeParse(input);
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(
          r.error.issues.some((i) => i.path[0] === "newPasswordConfirmation"),
        ).toBe(true);
      }
    });

    it("mismatch → «Пароли не совпадают» на пути newPasswordConfirmation", () => {
      const r = changePasswordSchema.safeParse(
        validInput({ newPasswordConfirmation: `${VALID_PASSWORD}x` }),
      );
      expect(r.success).toBe(false);
      if (!r.success) {
        const issue = r.error.issues.find(
          (i) =>
            i.message === "Пароли не совпадают" &&
            i.path[0] === "newPasswordConfirmation",
        );
        expect(issue).toBeDefined();
      }
    });
  });

  describe("некорректные типы", () => {
    it("currentPassword — число", () => {
      const r = changePasswordSchema.safeParse(
        validInput({ currentPassword: 123 }),
      );
      expect(r.success).toBe(false);
    });

    it("newPassword — число", () => {
      const r = changePasswordSchema.safeParse(
        validInput({ newPassword: 123 }),
      );
      expect(r.success).toBe(false);
    });

    it("пустой объект", () => {
      const r = changePasswordSchema.safeParse({});
      expect(r.success).toBe(false);
    });
  });
});
