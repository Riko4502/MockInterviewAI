import { z } from "zod";

/**
 * Zod-схема публичного профиля пользователя.
 */
export const publicUserProfileSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  gitUrl: z.string().nullable(),
  createdAt: z.date().or(z.string()),
});

export type PublicUserProfileDto = z.infer<typeof publicUserProfileSchema>;

/**
 * Zod-схема полного профиля текущего пользователя (с email).
 */
export const userProfileSchema = publicUserProfileSchema.extend({
  email: z.string().email(),
  updatedAt: z.date().or(z.string()),
});

export type UserProfileDto = z.infer<typeof userProfileSchema>;
