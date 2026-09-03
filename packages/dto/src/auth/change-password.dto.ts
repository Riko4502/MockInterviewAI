import { z } from "zod";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";

/**
 * Zod-схема валидации смены пароля (§67 SPEC.md).
 *
 * Проверяет:
 * - currentPassword: non-empty («Текущий пароль обязателен»), max 128;
 * - newPassword: password policy (§7, min 12, max 128 символов);
 * - newPasswordConfirmation: non-empty («Подтверждение пароля обязательно»),
 *   совпадение с newPassword через `.refine()` — «Пароли не совпадают»,
 *   ошибка на пути `newPasswordConfirmation`.
 *
 * `newPasswordConfirmation` существует только для валидации: `.transform()`
 * удаляет его из результата парсинга — выходной тип и `ChangePasswordDto`
 * остаются `{ currentPassword, newPassword }`; поле не попадает в сервисы
 * и логи (§45–46 SPEC.md).
 *
 * Сообщения об ошибках русские, единые для API-ответов и UI (§63 SPEC.md).
 *
 * @see {@link https://spec.md | SPEC.md §7, §63, §67}
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "Текущий пароль обязателен")
      .max(
        PASSWORD_MAX_LENGTH,
        `Пароль должен содержать максимум ${PASSWORD_MAX_LENGTH} символов`,
      ),
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
  })
  .transform((data) => ({
    currentPassword: data.currentPassword,
    newPassword: data.newPassword,
  }));

/** Типизированный DTO смены пароля: `newPasswordConfirmation` в результат не попадает. */
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
