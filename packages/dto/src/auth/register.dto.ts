import { z } from "zod";
import { normalizeEmail } from "./email";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";

/**
 * Zod-схема валидации данных регистрации (§5 SPEC.md).
 *
 * Проверяет:
 * - email: non-empty («Email обязателен»), корректный формат («Некорректный
 *   email»), нормализация (trim + lowercase);
 * - password: соответствует password policy (min 12, max 128 символов);
 * - passwordConfirmation: non-empty («Подтверждение пароля обязательно»),
 *   совпадение с password через `.refine()` — «Пароли не совпадают»,
 *   ошибка на пути `passwordConfirmation`.
 *
 * `passwordConfirmation` существует только для валидации: `.transform()`
 * удаляет его из результата парсинга — выходной тип и `RegisterDto`
 * остаются `{ email, password }`; поле не попадает в сервисы и логи
 * (§45–46 SPEC.md).
 *
 * Сообщения об ошибках русские, единые для API-ответов и UI (§63 SPEC.md).
 *
 * @see {@link https://spec.md | SPEC.md §5, §7, §63}
 */
export const registerSchema = z
  .object({
    email: z
      .string()
      .trim()
      .min(1, "Email обязателен")
      .pipe(z.email("Некорректный email"))
      .transform(normalizeEmail),
    password: z
      .string()
      .min(
        PASSWORD_MIN_LENGTH,
        `Пароль должен содержать минимум ${PASSWORD_MIN_LENGTH} символов`,
      )
      .max(
        PASSWORD_MAX_LENGTH,
        `Пароль должен содержать максимум ${PASSWORD_MAX_LENGTH} символов`,
      ),
    passwordConfirmation: z.string().min(1, "Подтверждение пароля обязательно"),
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: "Пароли не совпадают",
    path: ["passwordConfirmation"],
  })
  .transform((data) => ({
    email: data.email,
    password: data.password,
  }));

/** Типизированный DTO регистрации: `passwordConfirmation` в результат не попадает. */
export type RegisterDto = z.infer<typeof registerSchema>;
