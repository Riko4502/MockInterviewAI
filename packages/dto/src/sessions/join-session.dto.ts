import { z } from "zod";
import { interviewParticipantRoleSchema } from "./participant.dto";

/**
 * Zod-схема ответа на успешное присоединение к интервью-сессии.
 */
export const joinSessionResponseSchema = z.object({
  role: interviewParticipantRoleSchema,
});

/**
 * Типизированный DTO ответа на присоединение к интервью-сессии.
 */
export type JoinSessionResponseDto = z.infer<typeof joinSessionResponseSchema>;
