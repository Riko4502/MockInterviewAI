import { z } from "zod";
import { normalizeEmail } from "./email";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy";

/**
 * Zod-схема валидации данных регистрации.
 *
 * Проверяет:
 * - email: non-empty, корректный формат, нормализация (trim + lowercase);
 * - password: соответствует password policy (min 12, max 128 символов).
 *
 * @see {@link https://spec.md | SPEC.md §5, §7}
 */
export const registerSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform(normalizeEmail),
  password: z
    .string()
    .min(
      PASSWORD_MIN_LENGTH,
      `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    )
    .max(
      PASSWORD_MAX_LENGTH,
      `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    ),
});

/** Типизированный DTO регистрации. */
export type RegisterDto = z.infer<typeof registerSchema>;
