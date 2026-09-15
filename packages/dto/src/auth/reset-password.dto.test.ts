import { describe, expect, it } from "vitest";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";
import { resetPasswordSchema } from "./reset-password.dto";

const VALID_PASSWORD = "a".repeat(PASSWORD_MIN_LENGTH);

function validInput(overrides?: Partial<Record<string, unknown>>) {
  return {
    token: "sample-reset-token-12345",
    newPassword: VALID_PASSWORD,
    newPasswordConfirmation: VALID_PASSWORD,
    ...overrides,
  };
}

describe("resetPasswordSchema", () => {
  describe("успешная валидация", () => {
    it("валидный токен, newPassword и совпадающее подтверждение", () => {
      const result = resetPasswordSchema.parse(validInput());
      expect(result).toEqual({
        token: "sample-reset-token-12345",
        newPassword: VALID_PASSWORD,
        newPasswordConfirmation: VALID_PASSWORD,
      });
    });

    it("newPassword ровно MAX_LENGTH символов", () => {
      const longPassword = "a".repeat(PASSWORD_MAX_LENGTH);
      const result = resetPasswordSchema.parse(
        validInput({
          newPassword: longPassword,
          newPasswordConfirmation: longPassword,
        }),
      );
      expect(result.newPassword).toHaveLength(PASSWORD_MAX_LENGTH);
    });
  });

  describe("ошибки token", () => {
    it("пустой token → «Токен обязателен»", () => {
      const r = resetPasswordSchema.safeParse(validInput({ token: "" }));
      expect(r.success).toBe(false);
      if (!r.success) {
        expect(r.error.issues[0].message).toBe("Токен обязателен");
      }
    });

    it("отсутствие token → ошибка", () => {
      const input = validInput();
      delete (input as Record<string, unknown>).token;
      const r = resetPasswordSchema.safeParse(input);
      expect(r.success).toBe(false);
    });
  });

  describe("ошибки newPassword", () => {
    it("newPassword короче MIN_LENGTH", () => {
      const r = resetPasswordSchema.safeParse(
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
      const r = resetPasswordSchema.safeParse(
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

  describe("newPasswordConfirmation", () => {
    it("пустое подтверждение → «Подтверждение пароля обязательно»", () => {
      const r = resetPasswordSchema.safeParse(
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

    it("mismatch → «Пароли не совпадают» на пути newPasswordConfirmation", () => {
      const r = resetPasswordSchema.safeParse(
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
});
