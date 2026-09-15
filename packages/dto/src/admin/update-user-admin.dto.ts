import { z } from "zod";
import { normalizeEmail } from "../auth/email";
import {
  GIT_URL_REGEX,
  normalizeTelegramUsername,
  TELEGRAM_USERNAME_REGEX,
  USERNAME_REGEX,
} from "../profile/update-profile.dto";

/**
 * Zod-схема обновления пользователя администратором.
 */
export const updateUserAdminSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email must be a valid email address")
    .transform(normalizeEmail)
    .optional(),
  displayName: z
    .string()
    .trim()
    .min(1, "Display name must be at least 1 character")
    .max(100, "Display name must be at most 100 characters")
    .optional()
    .nullable(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      USERNAME_REGEX,
      "Username must be 3-30 characters (letters, numbers, underscore, hyphen)",
    )
    .optional()
    .nullable(),
  role: z.string().trim().optional(),
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

/**
 * DTO обновления пользователя администратором.
 */
export type UpdateUserAdminDto = z.infer<typeof updateUserAdminSchema>;
