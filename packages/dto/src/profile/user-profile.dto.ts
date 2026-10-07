import { locales } from "@packages/i18n";
import { THEME_MODES } from "@packages/types";
import { z } from "zod";
import {
  experienceLevelEnum,
  specializationEnum,
} from "../showcase/showcase.enums";

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
 * Zod-схема полного профиля текущего пользователя (с email, role и целями онбординга).
 */
export const userProfileSchema = publicUserProfileSchema.extend({
  email: z.string().email(),
  role: z.string(),
  permissions: z.string(),
  theme: z.enum(THEME_MODES),
  locale: z.enum(locales),
  updatedAt: z.iso.datetime(),
  telegramLinkVerified: z.boolean().default(false),
  githubLinkVerified: z.boolean().default(false),
  onboardingCompleted: z.boolean().default(false),
  targetRole: specializationEnum.nullable().optional(),
  targetLevel: experienceLevelEnum.nullable().optional(),
  targetCompanies: z.array(z.string()).default([]),
  targetTimeline: z.string().nullable().optional(),
  preferredFormat: z.string().nullable().optional(),
  onboardingAt: z.iso.datetime().nullable().optional(),
});

export type UserProfileDto = z.infer<typeof userProfileSchema>;
