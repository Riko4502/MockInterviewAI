import { z } from "zod";

/** IT-специализации карточек для взаимных собеседований. */
export const specializationEnum = z.enum([
  "FRONTEND",
  "BACKEND",
  "FULLSTACK",
  "DEVOPS",
  "QA",
  "MOBILE",
  "DATA_ML",
  "SYSTEM_DESIGN",
]);

/** Грейды/уровни опыта участников. */
export const experienceLevelEnum = z.enum([
  "JUNIOR",
  "MIDDLE",
  "SENIOR",
  "LEAD",
]);

/** Язык проведения собеседования. */
export const interviewLanguageEnum = z.enum(["RU", "EN", "ANY"]);

/** Статус публикации карточки на витрине. */
export const showcaseCardStatusEnum = z.enum(["ACTIVE", "INACTIVE", "EXPIRED"]);

/** Статус жизненного цикла заявки на интервью (MatchRequest). */
export const matchRequestStatusEnum = z.enum([
  "PENDING",
  "ACCEPTED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
]);

/** Варианты сортировки карточек в каталоге витрины. */
export const showcaseSortByEnum = z.enum([
  "BUMPED", // По дате поднятия в топ (дефолт)
  "NEWEST", // По дате создания
  "LEVEL_ASC",
  "LEVEL_DESC",
]);

export type Specialization = z.infer<typeof specializationEnum>;
export type ExperienceLevel = z.infer<typeof experienceLevelEnum>;
export type InterviewLanguage = z.infer<typeof interviewLanguageEnum>;
export type ShowcaseCardStatus = z.infer<typeof showcaseCardStatusEnum>;
export type MatchRequestStatus = z.infer<typeof matchRequestStatusEnum>;
export type ShowcaseSortBy = z.infer<typeof showcaseSortByEnum>;
