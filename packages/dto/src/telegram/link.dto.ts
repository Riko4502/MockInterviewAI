import { z } from "zod";

const CHAT_ID_MAX = 32;
const TOKEN_MAX = 64;

/**
 * Zod-схема тела запроса привязки Telegram-чата к пользователю
 * (`POST /api/v1/telegram/link`, вызывается ботом по `/start <token>`).
 *
 * - `token` — raw-токен из deep-link `?start=` Telegram: лимит параметра
 *   Telegram — 64 символа (`TOKEN_MAX`), лимит против абьюза Redis-ключей;
 * - `chatId` — идентификатор Telegram-чата как строка, `max(32)` —
 *   защита от абьюза Redis-ключей (§6.2 TELEGRAM_BOT_ARCHITECTURE.md).
 */
export const linkRequestSchema = z.object({
  token: z
    .string()
    .min(1, "Токен обязателен")
    .max(TOKEN_MAX, `Токен должен содержать максимум ${TOKEN_MAX} символа`),
  chatId: z
    .string()
    .min(1, "chatId обязателен")
    .max(
      CHAT_ID_MAX,
      `chatId должен содержать максимум ${CHAT_ID_MAX} символа`,
    ),
});

export type LinkRequest = z.infer<typeof linkRequestSchema>;

/**
 * Zod-схема ответа генерации токена привязки (`POST /api/v1/telegram/link-token`).
 */
export const linkTokenResponseSchema = z.object({
  linkUrl: z.string().min(1, "linkUrl обязателен"),
});

export type LinkTokenResponse = z.infer<typeof linkTokenResponseSchema>;
