import { z } from "zod";
import { interviewParticipantRoleSchema } from "./participant.dto";

/**
 * Zod-схема запроса на присоединение к интервью-сессии.
 */
export const joinSessionSchema = z
  .object({
    inviteToken: z.string().optional(),
  })
  .optional()
  .default({});

/**
 * Типизированный DTO запроса на присоединение к интервью-сессии.
 */
export type JoinSessionDto = z.infer<typeof joinSessionSchema>;

/**
 * Zod-схема ответа на успешное присоединение к интервью-сессии.
 */
export const joinSessionResponseSchema = z.object({
  role: interviewParticipantRoleSchema,
  inviteToken: z.string(),
});

/**
 * Типизированный DTO ответа на присоединение к интервью-сессии.
 */
export type JoinSessionResponseDto = z.infer<typeof joinSessionResponseSchema>;

/**
 * Zod-схема ответа на успешное создание интервью-сессии.
 */
export const createSessionResponseSchema = z.object({
  sessionId: z.string().uuid(),
  inviteToken: z.string(),
});

/**
 * Типизированный DTO ответа на создание интервью-сессии.
 */
export type CreateSessionResponseDto = z.infer<
  typeof createSessionResponseSchema
>;
