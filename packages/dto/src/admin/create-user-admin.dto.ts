import { z } from "zod";
import { normalizeEmail } from "../auth/email";
import { USERNAME_REGEX } from "../profile/update-profile.dto";

/**
 * Zod-схема создания пользователя администратором.
 */
export const createUserAdminSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Email must be a valid email address")
    .transform(normalizeEmail),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128, "Password must be at most 128 characters"),
  role: z.string().trim().optional().default("USER"),
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
