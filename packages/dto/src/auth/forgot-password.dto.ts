import { z } from "zod";
import { normalizeEmail } from "./email";

/**
 * Zod-схема валидации запроса на сброс пароля.
 *
 * Проверяет:
 * - email: non-empty («Email обязателен»), корректный формат («Некорректный email»),
 *   нормализация (trim + lowercase).
 *
 * Сообщения об ошибках русские, единые для API-ответов и UI (§63 SPEC.md).
 */
export const forgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email обязателен")
    .pipe(z.email("Некорректный email"))
    .transform(normalizeEmail),
});

/** Типизированный DTO запроса на сброс пароля. */
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
