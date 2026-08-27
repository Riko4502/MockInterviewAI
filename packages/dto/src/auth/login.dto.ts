import { z } from "zod";
import { normalizeEmail } from "./email";
import { PASSWORD_MAX_LENGTH } from "./password-policy";

/**
 * Zod-схема валидации данных входа.
 *
 * Проверяет:
 * - email: non-empty («Email обязателен»), корректный формат («Некорректный
 *   email»), нормализация (trim + lowercase) — как в {@link registerSchema};
 * - password: только заполненность («Пароль обязателен», max 128); password
 *   policy (min 12) к логину не применяется — корректность пароля проверяется
 *   сравнением с сохранённым хешем (§58 SPEC.md).
 *
 * Сообщения об ошибках русские, единые для API-ответов и UI (§63 SPEC.md).
 *
 * @see {@link https://spec.md | SPEC.md §5, §8, §58, §63}
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email обязателен")
    .pipe(z.email("Некорректный email"))
    .transform(normalizeEmail),
  password: z
    .string()
    .min(1, "Пароль обязателен")
    .max(
      PASSWORD_MAX_LENGTH,
      `Пароль должен содержать максимум ${PASSWORD_MAX_LENGTH} символов`,
    ),
});

/** Типизированный DTO входа. */
export type LoginDto = z.infer<typeof loginSchema>;
