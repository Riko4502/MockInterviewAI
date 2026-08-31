import { z } from "zod";

/**
 * Регулярное выражение для валидации юзернейма.
 * Разрешены латинские буквы, цифры, дефис и подчеркивание (3-30 символов).
 */
export const USERNAME_REGEX = /^[a-zA-Z0-9_-]{3,30}$/;

/**
 * Регулярное выражение для Telegram username (с опциональным `@` в начале, 5-32 символов).
 */
export const TELEGRAM_USERNAME_REGEX = /^@?[a-zA-Z0-9_]{5,32}$/;

/**
 * Регулярное выражение для ссылок на GitHub или GitLab профиль.
 */
export const GIT_URL_REGEX =
  /^https?:\/\/(www\.)?(github|gitlab)\.com\/[a-zA-Z0-9_.-]+\/?$/i;

/**
 * Нормализация Telegram юзернейма: удаление префикса `@` и trim.
 */
export function normalizeTelegramUsername(username: string): string {
  return username.trim().replace(/^@/, "");
}

/**
 * Zod-схема валидации обновления профиля пользователя.
 */
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Display name must be at least 2 characters")
    .max(50, "Display name must be at most 50 characters")
    .optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      USERNAME_REGEX,
      "Username must be 3-30 characters (letters, numbers, underscore, hyphen)",
    )
    .optional(),
  avatarUrl: z
    .string()
    .trim()
    .url("Avatar URL must be a valid URL")
    .optional()
    .nullable(),
  telegramUsername: z
    .string()
    .trim()
    .regex(TELEGRAM_USERNAME_REGEX, "Telegram username must be 5-32 characters")
    .transform(normalizeTelegramUsername)
    .optional()
    .nullable(),
  gitUrl: z
    .string()
    .trim()
    .regex(
      GIT_URL_REGEX,
      "Git URL must be a valid GitHub or GitLab profile link",
    )
    .optional()
    .nullable(),
});

/** Типизированный DTO обновления профиля. */
export type UpdateProfileDto = z.infer<typeof updateProfileSchema>;
