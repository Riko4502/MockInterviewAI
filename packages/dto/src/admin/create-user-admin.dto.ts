import { z } from "zod";
import { normalizeEmail } from "../auth/email";
import { USERNAME_REGEX } from "../profile/update-profile.dto";

/**
 * Zod-схема создания пользователя администратором.
 * Пароль генерируется сервером (Zero-Knowledge) и отправляется на email.
 */
export const createUserAdminSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Email обязателен")
    .pipe(z.email("Некорректный email"))
    .transform(normalizeEmail),
  role: z
    .string()
    .trim()
    .min(1, "Role must not be empty")
    .optional()
    .default("USER"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      USERNAME_REGEX,
      "Username must be 3-30 characters (letters, numbers, underscore, hyphen)",
    )
    .optional(),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name must be at least 1 character")
    .max(100, "Display name must be at most 100 characters")
    .optional(),
  isActive: z.boolean().optional().default(true),
});

/**
 * DTO создания пользователя администратором.
 */
export type CreateUserAdminDto = z.infer<typeof createUserAdminSchema>;
