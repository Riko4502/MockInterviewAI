import { z } from "zod";

/**
 * Zod-схема тела запроса получения LiveKit join-токена для WebRTC медиа.
 *
 * Проверяет, что `sessionId` — корректный UUID.
 */
export const mediaTokenRequestSchema = z.object({
  sessionId: z.string().uuid("Некорректный sessionId"),
});

/** Типизированный DTO запроса media-токена. */
export type MediaTokenRequestDto = z.infer<typeof mediaTokenRequestSchema>;

/** Типизированный DTO ответа с LiveKit join-токеном. */
export type MediaTokenResponseDto = {
  token: string;
  serverUrl: string;
  roomName: string;
};
