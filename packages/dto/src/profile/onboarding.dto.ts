import { z } from "zod";
import {
  experienceLevelEnum,
  specializationEnum,
} from "../showcase/showcase.enums";

/**
 * Zod-схема завершения онбординга пользователем.
 * Поддерживает сохранение выбранных целей подготовки,
 * санитизацию данных (лимит до 10 компаний) и Skip Flow (isSkipped).
 */
export const completeOnboardingSchema = z.object({
  role: specializationEnum.optional(),
  level: experienceLevelEnum.optional(),
  companies: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
  timeline: z.enum(["now", "soon", "passive"]).optional(),
  format: z.enum(["ai", "peer", "sandbox"]).optional(),
  isSkipped: z.boolean().default(false),
});

export type CompleteOnboardingDto = z.infer<typeof completeOnboardingSchema>;
