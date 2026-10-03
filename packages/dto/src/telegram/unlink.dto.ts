import { z } from "zod";

/**
 * Zod-схема тела запроса отвязки Telegram-чата (`POST /api/v1/telegram/unlink`).
 */
export const unlinkRequestSchema = z.object({
  chatId: z
    .string()
    .min(1, "chatId обязателен")
    .max(32, "chatId должен содержать максимум 32 символа"),
});

export type UnlinkRequest = z.infer<typeof unlinkRequestSchema>;

/**
 * Zod-схема ответа отвязки (`POST /api/v1/telegram/unlink`).
 */
export const unlinkResponseSchema = z.object({
  success: z.literal(true),
});

export type UnlinkResponse = z.infer<typeof unlinkResponseSchema>;
