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
  createdAt: z.iso.datetime(),
});

export type PublicUserProfileDto = z.infer<typeof publicUserProfileSchema>;

/**
 * Zod-схема полного профиля текущего пользователя (с email и role).
 */
export const userProfileSchema = publicUserProfileSchema.extend({
  email: z.string().email(),
  role: z.string(),
  permissions: z.string(),
  updatedAt: z.iso.datetime(),
});

export type UserProfileDto = z.infer<typeof userProfileSchema>;
