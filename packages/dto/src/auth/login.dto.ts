import { z } from "zod";
import { normalizeEmail } from "./email";

/**
 * Zod-схема валидации данных входа.
 *
 * Проверяет:
 * - email: non-empty, корректный формат, нормализация (trim + lowercase) —
 *   как в {@link registerSchema};
 * - password: только заполненность (1–128 символов); password policy
 *   (min 12) к логину не применяется — корректность пароля проверяется
 *   сравнением с сохранённым хешем (§58 SPEC.md).
 *
 * @see {@link https://spec.md | SPEC.md §5, §8, §58}
 */
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Invalid email format")
    .transform(normalizeEmail),
  password: z
    .string()
    .min(1, "Password is required")
    .max(128, "Password must be at most 128 characters"),
});

/** Типизированный DTO входа. */
export type LoginDto = z.infer<typeof loginSchema>;
