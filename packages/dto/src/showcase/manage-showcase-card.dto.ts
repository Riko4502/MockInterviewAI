import { z } from "zod";
import { normalizeSkill, stripHtmlTags } from "./search-parser";
import {
  experienceLevelEnum,
  interviewLanguageEnum,
  specializationEnum,
} from "./showcase.enums";

const baseShowcaseCardFields = {
  title: z
    .string()
    .trim()
    .min(3, "Заголовок должен содержать минимум 3 символа")
    .max(100, "Заголовок не должен превышать 100 символов")
    .transform(stripHtmlTags)
    .optional(),
  specialization: specializationEnum,
  level: experienceLevelEnum,
  language: interviewLanguageEnum,
  skills: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Название скилла не может быть пустым")
        .max(30, "Максимальная длина скилла — 30 символов")
        .transform(normalizeSkill),
    )
    .min(1, "Укажите хотя бы один ключевой навык")
    .max(20, "Нельзя указать более 20 навыков")
    .transform((items) => Array.from(new Set(items))),
  bio: z
    .string()
    .trim()
    .max(500, "Описание не должно превышать 500 символов")
    .transform(stripHtmlTags)
    .optional()
    .nullable(),
  scheduleInfo: z
    .string()
    .trim()
    .max(300, "Информация о расписании не должна превышать 300 символов")
    .transform(stripHtmlTags)
    .optional()
    .nullable(),
  isUrgent: z.boolean(),
  autoRenew: z.boolean(),
};

/**
 * [Request] Схема валидации данных для создания карточки на витрине (POST /showcase).
 * Проверяет обязательные поля (специализация, уровень, навыки) и очищает текст от XSS.
 */
export const createShowcaseCardSchema = z.object({
  ...baseShowcaseCardFields,
  language: baseShowcaseCardFields.language.default("RU"),
  isUrgent: baseShowcaseCardFields.isUrgent.default(false),
  autoRenew: baseShowcaseCardFields.autoRenew.default(false),
});

/**
 * [Request] Схема валидации для частичного обновления карточки (PATCH /showcase/:id).
 * Все поля опциональны — пользователь может обновить только то, что изменил (без подстановки дефолтов).
 */
export const updateShowcaseCardSchema = z
  .object(baseShowcaseCardFields)
  .partial();

/**
 * [Request] Схема переключения статуса карточки (PATCH /showcase/:id/status).
 * Позволяет автору временно скрыть карточку с витрины (INACTIVE) или включить обратно (ACTIVE).
 */
export const updateShowcaseCardStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE"]),
});

/** [Request DTO] Тело запроса при создании карточки. */
export type CreateShowcaseCardDto = z.infer<typeof createShowcaseCardSchema>;

/** [Request DTO] Тело запроса при редактировании карточки. */
export type UpdateShowcaseCardDto = z.infer<typeof updateShowcaseCardSchema>;

/** [Request DTO] Тело запроса при смене статуса карточки. */
export type UpdateShowcaseCardStatusDto = z.infer<
  typeof updateShowcaseCardStatusSchema
>;
