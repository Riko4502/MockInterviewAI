import {
  GIT_URL_REGEX,
  locales,
  normalizeTelegramUsername,
  TELEGRAM_USERNAME_REGEX,
  THEME_MODES,
  type UpdateProfileDto,
  USERNAME_REGEX,
} from "@packages/dto";
import { z } from "zod";

type ProfileErrorKey =
  | "profile.errors.displayNameMin"
  | "profile.errors.displayNameMax"
  | "profile.errors.username"
  | "profile.errors.telegram"
  | "profile.errors.gitUrl";

export function createProfileFormSchema(t: (key: ProfileErrorKey) => string) {
  return z.object({
    displayName: z
      .string()
      .trim()
      .min(2, t("profile.errors.displayNameMin"))
      .max(50, t("profile.errors.displayNameMax")),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(USERNAME_REGEX, t("profile.errors.username")),
    telegramUsername: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || TELEGRAM_USERNAME_REGEX.test(value),
        t("profile.errors.telegram"),
      ),
    gitUrl: z
      .string()
      .trim()
      .refine(
        (value) => value === "" || GIT_URL_REGEX.test(value),
        t("profile.errors.gitUrl"),
      ),
    theme: z.enum(THEME_MODES),
    locale: z.enum(locales),
  });
}

export type ProfileFormValues = z.infer<
  ReturnType<typeof createProfileFormSchema>
>;

export function toUpdateProfileDto(
  values: ProfileFormValues,
  dirtyFields?: Partial<Record<keyof ProfileFormValues, boolean>>,
): UpdateProfileDto {
  const telegramUsername = values.telegramUsername.trim();
  const gitUrl = values.gitUrl.trim();

  const dto: UpdateProfileDto = {};

  if (!dirtyFields || dirtyFields.displayName) {
    dto.displayName = values.displayName.trim();
  }
  if (!dirtyFields || dirtyFields.username) {
    dto.username = values.username.trim().toLowerCase();
  }
  if (!dirtyFields || dirtyFields.telegramUsername) {
    dto.telegramUsername =
      telegramUsername === ""
        ? null
        : normalizeTelegramUsername(telegramUsername);
  }
  if (!dirtyFields || dirtyFields.gitUrl) {
    dto.gitUrl = gitUrl === "" ? null : gitUrl;
  }
  if (!dirtyFields || dirtyFields.theme) {
    dto.theme = values.theme;
  }
  if (!dirtyFields || dirtyFields.locale) {
    dto.locale = values.locale;
  }

  return dto;
}
