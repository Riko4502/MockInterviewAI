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
): UpdateProfileDto {
  const telegramUsername = values.telegramUsername.trim();
  const gitUrl = values.gitUrl.trim();

  return {
    displayName: values.displayName.trim(),
    username: values.username.trim().toLowerCase(),
    telegramUsername:
      telegramUsername === ""
        ? null
        : normalizeTelegramUsername(telegramUsername),
    gitUrl: gitUrl === "" ? null : gitUrl,
    theme: values.theme,
    locale: values.locale,
  };
}
