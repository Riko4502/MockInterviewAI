import { z } from "zod";
import {
  experienceLevelEnum,
  interviewLanguageEnum,
  showcaseCardStatusEnum,
  specializationEnum,
} from "./showcase.enums";
import { showcaseSlotResponseSchema } from "./showcase-slot.dto";

/**
 * [Response] Публичная визитка автора карточки.
 * Содержит только безопасные данные пользователя (без email и хеша пароля).
 * Поле telegramUsername заполняется только после взаимного принятия заявки (ACCEPTED).
 */
export const publicUserCardSchema = z.object({
  id: z.uuid(),
  displayName: z.string().nullable(),
  username: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  telegramUsername: z.string().nullable(),
  gitUrl: z.string().nullable(),
});

export type PublicUserCardDto = z.infer<typeof publicUserCardSchema>;

/**
 * [Response] Статистика заявок для автора карточки.
 * Возвращается только владельцу карточки в личном кабинете (GET /showcase/my).
 */
export const showcaseCardStatsSchema = z.object({
  pendingRequestsCount: z.number().int().nonnegative(),
  acceptedRequestsCount: z.number().int().nonnegative(),
});

export type ShowcaseCardStatsDto = z.infer<typeof showcaseCardStatsSchema>;

/**
 * [Response] Полные данные карточки участника витрины.
 * Отдаётся сервером клиенту при создании, редактировании или просмотре анкеты на витрине.
 *
 * Даты описаны как ISO-строки, а не как `Date`: это форма, в которой они
 * уходят клиенту, и она же является единственным источником правды для типа
 * `ShowcaseCardResponseDto` и для схемы OpenAPI. Службы преобразуют `Date`
 * в строку сами — см. `toShowcaseCardResponse`.
 */
export const showcaseCardResponseSchema = z.object({
  id: z.uuid(),
  userId: z.uuid(),
  user: publicUserCardSchema,
  title: z.string().nullable(),
  specialization: specializationEnum,
  level: experienceLevelEnum,
  language: interviewLanguageEnum,
  skills: z.array(z.string()),
  bio: z.string().nullable(),
  /**
   * Свободное описание расписания (ADR-002:63).
   *
   * Поле вытесняется слотами: как только у карточки есть слоты, в выдаче
   * витрины оно не возвращается, иначе показывались бы два разных расписания
   * одной карточки. Удаление колонки — отдельная миграция после переходного
   * периода, поэтому значение владельца остаётся в базе.
   */
  scheduleInfo: z.string().nullable(),
  /** Слоты доступности; приходят вместе с карточкой, отдельной выборки нет. */
  slots: z.array(showcaseSlotResponseSchema),
  isUrgent: z.boolean(),
  status: showcaseCardStatusEnum,
  autoRenew: z.boolean(),
  bumpedAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  /** Дополнительная статистика (заполняется только для автора в GET /showcase/my) */
  stats: showcaseCardStatsSchema.optional(),
});

export type ShowcaseCardResponseDto = z.infer<
  typeof showcaseCardResponseSchema
>;

/** [Response] Список карточек витрины без постраничной обёртки (GET /showcase/my). */
export const showcaseCardListSchema = z.array(showcaseCardResponseSchema);

export type ShowcaseCardListDto = z.infer<typeof showcaseCardListSchema>;

/**
 * Мета-информация постраничной навигации витрины и матчмейкинга.
 *
 * Ключ предыдущей страницы здесь называется `hasPrevPage`, а не
 * `hasPreviousPage`, как в админском `paginationMetaSchema`. Это два разных
 * фактических контракта эндпоинтов: приводить их к одному — значит ломать
 * клиента, поэтому расхождение зафиксировано здесь, а не исправлено.
 */
export const paginatedListMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPrevPage: z.boolean(),
});

export type PaginatedListMetaDto = z.infer<typeof paginatedListMetaSchema>;

/**
 * Фабрика пагинированной обёртки витрины и матчмейкинга.
 *
 * Zod не выражает дженерики, поэтому обёртка собирается из схемы элемента.
 * Тип `PaginatedResponseDto<T>` остаётся параметризованным элементом — им
 * пользуются службы, — а в OpenAPI попадают конкретные инстансы, иначе
 * сгенерированный клиент не смог бы их описать.
 */
export function paginatedResponseSchema<TItem extends z.ZodType>(item: TItem) {
  return z.object({ data: z.array(item), meta: paginatedListMetaSchema });
}

/** [Response] Пагинированный каталог витрины (GET /showcase). */
export const paginatedShowcaseCardsSchema = paginatedResponseSchema(
  showcaseCardResponseSchema,
);

export type PaginatedShowcaseCardsDto = z.infer<
  typeof paginatedShowcaseCardsSchema
>;

/**
 * [Response] Универсальная обёртка пагинированного ответа API.
 * Содержит массив данных `data` и мета-информацию `meta` для постраничной навигации.
 *
 * Тип параметризован элементом, а не схемой: им пользуются службы, которые уже
 * знают тип элемента. Фактические поля описаны `paginatedListMetaSchema` и
 * `ShowcaseCardResponseDto`, то есть источник правды один.
 *
 * @example PaginatedResponseDto<ShowcaseCardResponseDto>
 */
export interface PaginatedResponseDto<TItem> {
  data: TItem[];
  meta: PaginatedListMetaDto;
}
