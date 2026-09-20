import { z } from "zod";

/**
 * Zod-схема query-параметров получения профиля по Telegram-чату
 * (`GET /api/v1/telegram/profile`).
 */
export const telegramProfileQuerySchema = z.object({
  chatId: z
    .string()
    .min(1, "chatId обязателен")
    .max(32, "chatId должен содержать максимум 32 символа"),
});

export type TelegramProfileQuery = z.infer<typeof telegramProfileQuerySchema>;

/**
 * Zod-схема профиля пользователя для Telegram-бота
 * (`TelegramUserProfileDto`, §7.2 TELEGRAM_BOT_ARCHITECTURE.md).
 *
 * `telegramLocale` — нормализованный двухбуквенный код (`ru`/`en`)
 * или `null` (не задан → автоопределение по `language_code`).
 */
export const telegramUserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  username: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  telegramChatId: z.string().nullable(),
  telegramLocale: z.enum(["ru", "en"]).nullable(),
  role: z.string(),
});

export type TelegramUserProfileDto = z.infer<typeof telegramUserProfileSchema>;
