import { z } from "zod";

/**
 * Zod-схема тела запроса обновления настроек Telegram
 * (`PATCH /api/v1/telegram/preferences`).
 *
 * `locale` — строго `"ru"` или `"en"` (§7.4 TELEGRAM_BOT_ARCHITECTURE.md).
 */
export const telegramPreferencesPatchSchema = z.object({
  chatId: z
    .string()
    .min(1, "chatId обязателен")
    .max(32, "chatId должен содержать максимум 32 символа"),
  locale: z.enum(["ru", "en"], {
    message: "Локаль должна быть ru или en",
  }),
});

export type TelegramPreferencesPatch = z.infer<
  typeof telegramPreferencesPatchSchema
>;
