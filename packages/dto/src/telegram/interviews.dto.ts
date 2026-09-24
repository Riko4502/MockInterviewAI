import { z } from "zod";

/**
 * Zod-схема query-параметров списка собеседований по Telegram-чату
 * (`GET /api/v1/telegram/interviews`).
 */
export const telegramInterviewsQuerySchema = z.object({
  chatId: z
    .string()
    .min(1, "chatId обязателен")
    .max(32, "chatId должен содержать максимум 32 символа"),
});

export type TelegramInterviewsQuery = z.infer<
  typeof telegramInterviewsQuerySchema
>;

/**
 * Zod-схема элемента списка собеседований (§7.3 TELEGRAM_BOT_ARCHITECTURE.md).
 *
 * - `role`: для владельца сессии — `INTERVIEWER`, иначе роль из
 *   `InterviewParticipant` (`CANDIDATE`/`INTERVIEWER`/`OBSERVER`).
 */
export const telegramInterviewSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["CREATED", "ACTIVE", "CLOSED"]),
  startedAt: z.date().or(z.string()).nullable(),
  role: z.enum(["CANDIDATE", "INTERVIEWER", "OBSERVER"]),
  createdAt: z.date().or(z.string()),
});

export type TelegramInterviewDto = z.infer<typeof telegramInterviewSchema>;

/**
 * Zod-схема ответа со списком предстоящих собеседований.
 */
export const telegramInterviewsListSchema = z.object({
  items: z.array(telegramInterviewSchema),
});

export type TelegramInterviewsListDto = z.infer<
  typeof telegramInterviewsListSchema
>;
