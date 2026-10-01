import {
  type CreateShowcaseCardDto,
  experienceLevelEnum,
  interviewLanguageEnum,
  specializationEnum,
  type UpdateShowcaseCardDto,
} from "@packages/dto";
import { z } from "zod";

export const createShowcaseFormSchema = (
  t: (key: string, options?: Record<string, unknown>) => string,
) =>
  z.object({
    specialization: specializationEnum,
    level: experienceLevelEnum,
    language: interviewLanguageEnum,
    skills: z
      .array(z.string().trim())
      .transform((items) => items.filter((item) => item.length > 0))
      .refine((items) => items.length >= 1, {
        message: t("form.errors.skillsMin"),
      })
      .refine((items) => items.length <= 20, {
        message: t("form.errors.skillsMax"),
      }),
    title: z
      .string()
      .trim()
      .max(100, t("form.errors.titleMax"))
      .optional()
      .or(z.literal("")),
    bio: z
      .string()
      .trim()
      .max(500, t("form.errors.bioMax"))
      .optional()
      .or(z.literal("")),
    scheduleInfo: z
      .string()
      .trim()
      .max(300, t("form.errors.scheduleMax"))
      .optional()
      .or(z.literal("")),
    isUrgent: z.boolean(),
    autoRenew: z.boolean(),
  });

export type ShowcaseFormValues = z.infer<
  ReturnType<typeof createShowcaseFormSchema>
>;

export function toCreateShowcaseCardDto(
  values: ShowcaseFormValues,
): CreateShowcaseCardDto {
  return {
    specialization: values.specialization,
    level: values.level,
    language: values.language,
    skills: values.skills,
    title: values.title?.trim() || undefined,
    bio: values.bio?.trim() || null,
    scheduleInfo: values.scheduleInfo?.trim() || null,
    isUrgent: values.isUrgent ?? false,
    autoRenew: values.autoRenew ?? false,
  };
}

export function toUpdateShowcaseCardDto(
  values: ShowcaseFormValues,
): UpdateShowcaseCardDto {
  return {
    specialization: values.specialization,
    level: values.level,
    language: values.language,
    skills: values.skills,
    title: values.title?.trim() || undefined,
    bio: values.bio?.trim() || null,
    scheduleInfo: values.scheduleInfo?.trim() || null,
    isUrgent: values.isUrgent,
    autoRenew: values.autoRenew,
  };
}
