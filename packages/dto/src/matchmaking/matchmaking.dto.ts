import { z } from "zod";
import { stripHtmlTags } from "../showcase/search-parser";
import { matchRequestStatusEnum } from "../showcase/showcase.enums";

/**
 * [Request] Схема валидации для создания заявки (отклика) на мок-интервью (POST /matchmaking/requests).
 *
 * Пользователь откликается на чужую карточку витрины (targetCardId).
 * Опционально может привязать свою карточку (senderCardId), оставить сообщение и тему для мока.
 */
export const createMatchRequestSchema = z.object({
  targetCardId: z.string().uuid("Некорректный UUID карточки витрины"),
  senderCardId: z.string().uuid("Некорректный UUID вашей карточки").optional(),
  message: z
    .string()
    .trim()
    .max(300, "Сообщение не должно превышать 300 символов")
    .transform(stripHtmlTags)
    .optional(),
  preferredTopic: z
    .string()
    .trim()
    .max(100, "Тема собеседования не должна превышать 100 символов")
    .transform(stripHtmlTags)
    .optional(),
});

/**
 * [Request] Схема валидации при отклонении заявки (POST /matchmaking/requests/:id/reject).
 * Позволяет автору карточки вежливо объяснить причину отказа (например: "Уже нашёл пару на эту неделю").
 */
export const rejectMatchRequestSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(200, "Причина отклонения не должна превышать 200 символов")
    .transform(stripHtmlTags)
    .optional(),
});

/**
 * [Request] Query-параметры фильтрации заявок (GET /matchmaking/requests/incoming и /outgoing).
 * Позволяет фильтровать заявки по статусу (PENDING, ACCEPTED...) и листать страницы.
 */
export const matchRequestQuerySchema = z.object({
  status: matchRequestStatusEnum.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

/** [Request DTO] Тело запроса для создания отклика на карточку. */
export type CreateMatchRequestDto = z.infer<typeof createMatchRequestSchema>;

/** [Request DTO] Тело запроса при отклонении заявки с причиной. */
export type RejectMatchRequestDto = z.infer<typeof rejectMatchRequestSchema>;

/** [Request DTO] Параметры строки запроса (query) для получения списка заявок. */
export type MatchRequestQueryDto = z.infer<typeof matchRequestQuerySchema>;
