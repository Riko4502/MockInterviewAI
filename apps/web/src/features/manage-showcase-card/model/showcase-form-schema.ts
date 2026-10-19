import {
  type CreateShowcaseCardDto,
  experienceLevelEnum,
  interviewLanguageEnum,
  MAX_SLOTS_PER_CARD,
  SLOT_DURATION_LIMITS,
  specializationEnum,
  type UpdateShowcaseCardDto,
} from "@packages/dto";
import { LOCAL_DATE_TIME_REGEX, resolveLocalTimeToUtc } from "@packages/utils";
import { z } from "zod";

/**
 * Элемент расписания в форме.
 *
 * `id` и `booked` живут только в UI: `id` нужен `useFieldArray`, `booked`
 * помечает занятый заявкой слот. На сервер такие слоты не уходят (иначе
 * `replaceSlots` даёт пересечение с самим собой и `409 Conflict`).
 */
export const slotItemSchema = z.object({
  id: z.string().optional(),
  startsAtLocal: z.string().regex(LOCAL_DATE_TIME_REGEX, "YYYY-MM-DDTHH:mm"),
  durationMinutes: z
    .number()
    .int()
    .min(SLOT_DURATION_LIMITS.MIN)
    .max(SLOT_DURATION_LIMITS.MAX),
  booked: z.boolean().optional(),
});

export type SlotFormValue = z.infer<typeof slotItemSchema>;

/**
 * Схема формы анкеты.
 *
 * @param authorTimezone - зона автора для проверки «слот не в прошлом»
 *   (ADR-002:65-66). Реализована по той же семантике, что и сервер:
 *   round-trip через `resolveLocalTimeToUtc`, несуществующее локальное время
 *   (DST) считается невалидным.
 */
export const createShowcaseFormSchema = (
  t: (key: string, options?: Record<string, unknown>) => string,
  authorTimezone = "UTC",
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
    slots: z
      .array(slotItemSchema)
      .optional()
      .superRefine((slots, ctx) => {
        if (!slots) {
          return;
        }

        const activeSlots = slots.filter((slot) => !slot.booked);

        if (activeSlots.length > MAX_SLOTS_PER_CARD) {
          ctx.addIssue({
            code: "custom",
            message: t("slots.addSlotDisabledMax"),
          });
        }

        slots.forEach((slot, index) => {
          if (slot.booked) {
            return;
          }

          const resolution = resolveLocalTimeToUtc(
            slot.startsAtLocal,
            authorTimezone,
          );

          if (!resolution.ok || resolution.utc.getTime() <= Date.now()) {
            ctx.addIssue({
              code: "custom",
              path: [index, "startsAtLocal"],
              message: t("slots.cannotAddInPast"),
            });
          }
        });
      }),
  });

export type ShowcaseFormValues = z.infer<
  ReturnType<typeof createShowcaseFormSchema>
>;

/**
 * Маппит слоты формы в DTO.
 *
 * BOOKED-слоты исключаются (см. `slotItemSchema`); если не осталось ни одного
 * отправляемого слота — поле не передаётся, и сервер оставляет занятые слоты
 * без изменений.
 */
function toSlotsDto(
  slots: SlotFormValue[] | undefined,
): { startsAtLocal: string; durationMinutes: number }[] | undefined {
  if (!slots || !slots.some((slot) => !slot.booked)) {
    return undefined;
  }

  return slots
    .filter((slot) => !slot.booked)
    .map((slot) => ({
      startsAtLocal: slot.startsAtLocal,
      durationMinutes: slot.durationMinutes,
    }));
}

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
    slots: toSlotsDto(values.slots),
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
    title: values.title?.trim() || null,
    bio: values.bio?.trim() || null,
    scheduleInfo: values.scheduleInfo?.trim() || null,
    isUrgent: values.isUrgent,
    autoRenew: values.autoRenew,
    slots: toSlotsDto(values.slots),
  };
}
