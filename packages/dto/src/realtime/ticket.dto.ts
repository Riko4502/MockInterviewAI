import { z } from "zod";

/**
 * Zod-схема тела запроса получения одноразового тикета для WebSocket.
 *
 * Проверяет, что `sessionId` — корректный UUID (`z.string().uuid()`).
 */
export const ticketSchema = z.object({
  sessionId: z.string().uuid("Некорректный sessionId"),
});

/** Типизированный DTO запроса тикета. */
export type TicketDto = z.infer<typeof ticketSchema>;
