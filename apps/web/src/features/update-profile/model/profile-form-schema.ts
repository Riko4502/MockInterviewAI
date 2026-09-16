import {
  GIT_URL_REGEX,
  normalizeTelegramUsername,
  TELEGRAM_USERNAME_REGEX,
  type UpdateProfileDto,
  USERNAME_REGEX,
} from "@packages/dto";
import { z } from "zod";

export const profileFormSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Имя должно содержать минимум 2 символа")
    .max(50, "Имя должно содержать максимум 50 символов"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      USERNAME_REGEX,
      "Имя пользователя: 3–30 символов, латиница, цифры, _ и -",
    ),
  telegramUsername: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || TELEGRAM_USERNAME_REGEX.test(value),
      "Telegram: 5–32 символа, латиница, цифры и _",
    ),
  gitUrl: z
    .string()
    .trim()
    .refine(
      (value) => value === "" || GIT_URL_REGEX.test(value),
      "Укажите ссылку на профиль GitHub или GitLab",
    ),
});

export type ProfileFormValues = z.infer<typeof profileFormSchema>;

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
  };
}
