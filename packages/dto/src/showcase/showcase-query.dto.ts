import { z } from "zod";
import {
  experienceLevelEnum,
  interviewLanguageEnum,
  showcaseSortByEnum,
  specializationEnum,
} from "./showcase.enums";

/**
 * [Request] Схема валидации query-параметров поиска карточек (GET /showcase).
 * Поддерживает фильтры по специализации, уровню, языку, бейджу срочности,
 * выбор конкретного навыка, поиск с операторами (+react, -vue) и пагинацию.
 */
export const showcaseQuerySchema = z.object({
  specialization: specializationEnum.optional(),
  level: experienceLevelEnum.optional(),
  language: interviewLanguageEnum.optional(),
  isUrgent: z.preprocess((val) => {
    if (typeof val === "string") {
      const normalized = val.trim().toLowerCase();
      if (normalized === "true" || normalized === "1") return true;
      if (normalized === "false" || normalized === "0") return false;
    }
    return val;
  }, z.boolean().optional()),
  skill: z.string().trim().optional(),
  search: z.string().trim().max(100).optional(), // Поиск с операторами: "+react -vue middle"
  sortBy: showcaseSortByEnum.default("BUMPED"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** [Request DTO] Параметры строки запроса (query) для фильтрации и пагинации витрины. */
export type ShowcaseQueryDto = z.infer<typeof showcaseQuerySchema>;
