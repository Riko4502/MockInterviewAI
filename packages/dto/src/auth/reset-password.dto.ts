import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";

/**
 * Zod-схема валидации установки нового пароля по токену сброса.
 *
 * Проверяет:
 * - token: non-empty («Токен обязателен»);
 * - newPassword: password policy (min 12, max 128 символов);
 * - newPasswordConfirmation: non-empty («Подтверждение пароля обязательно»),
 *   совпадение с newPassword через `.refine()` — «Пароли не совпадают»,
 *   ошибка на пути `newPasswordConfirmation`.
 *
 * Сообщения об ошибках русские, единые для API-ответов и UI (§63 SPEC.md).
 */
export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Токен обязателен"),
    newPassword: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `Пароль должен содержать максимум ${PASSWORD_MAX_LENGTH} символов`,
      ),
    newPasswordConfirmation: z
      .string()
      .min(1, "Подтверждение пароля обязательно"),
  })
  .refine((data) => data.newPassword === data.newPasswordConfirmation, {
    message: "Пароли не совпадают",
    path: ["newPasswordConfirmation"],
  });

/** Типизированный DTO установки нового пароля. */
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
