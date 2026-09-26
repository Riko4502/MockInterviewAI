import { z } from "zod";
import { normalizeEmail } from "./email";

/**
 * Схема входящих данных Widget Telegram OAuth.
 * Поля payload: id, first_name, last_name, username, photo_url, auth_date, hash
 */
export const telegramAuthSchema = z.object({
  id: z.coerce.number().int().positive(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  username: z.string().nullable().optional(),
  photo_url: z.string().url().nullable().optional(),
  auth_date: z.coerce.number().int().positive(),
  hash: z.string().min(1),
});

export type TelegramAuthDto = z.infer<typeof telegramAuthSchema>;

/**
 * Схема завершения регистрации по Telegram.
 */
export const telegramCompleteSchema = z.object({
  onboardingToken: z.string().min(1),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Некорректный формат email")
    .transform((val) => normalizeEmail(val)),
});

export type TelegramCompleteDto = z.infer<typeof telegramCompleteSchema>;

/**
 * Схема привязки аккаунта Telegram к текущему пользователю.
 */
export const telegramLinkSchema = telegramAuthSchema;

export type TelegramLinkDto = z.infer<typeof telegramLinkSchema>;
