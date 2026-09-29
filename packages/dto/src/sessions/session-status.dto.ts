import { z } from "zod";

/**
 * Статусы жизненного цикла интервью-сессии (синхронно с Prisma enum InterviewSessionStatus).
 */
export const interviewSessionStatusSchema = z.enum([
  "CREATED",
  "ACTIVE",
  "CLOSED",
]);

/**
 * Объект-enum значений статуса интервью-сессии.
 */
export const InterviewSessionStatus = interviewSessionStatusSchema.enum;

/**
 * Тип статуса интервью-сессии.
 */
export type InterviewSessionStatus = z.infer<
  typeof interviewSessionStatusSchema
>;
