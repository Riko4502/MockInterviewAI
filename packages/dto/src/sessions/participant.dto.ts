import { z } from "zod";

/** Роли участника интервью-сессии (синхронно с Prisma enum InterviewParticipantRole). */
export const interviewParticipantRoleSchema = z.enum([
  "CANDIDATE",
  "INTERVIEWER",
  "OBSERVER",
]);

/** Тип роли участника интервью-сессии. */
export type InterviewParticipantRole = z.infer<
  typeof interviewParticipantRoleSchema
>;

/**
 * Zod-схема тела запроса добавления участника в сессию.
 *
 * Проверяет:
 * - userId: обязательный, непустой;
 * - role: одна из допустимых ролей (CANDIDATE / INTERVIEWER / OBSERVER).
 */
export const addParticipantSchema = z.object({
  userId: z.string().trim().min(1, "userId обязателен"),
  role: interviewParticipantRoleSchema,
});

/** Типизированный DTO добавления участника. */
export type AddParticipantDto = z.infer<typeof addParticipantSchema>;
