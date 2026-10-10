import { LOCAL_DATE_TIME_REGEX } from "@packages/utils";
import { z } from "zod";

/**
 * Слоты доступности (ADR-002:58-66).
 *
 * На проводе слот описан локальным временем владельца карточки без смещения:
 * зону определяет `User.timezone`, а момент в базе хранится только как
 * UTC-инстант (ADR-002:54). Смещение в запросе не принимается именно поэтому —
 * приняв его, пришлось бы выбирать, чьё оно, а ответственность за это у сервера.
 */

/** Границы длительности интервью в минутах. */
export const SLOT_DURATION_LIMITS = {
  MIN: 15,
  MAX: 240,
} as const;

/** Не более 10 слотов на карточку (ADR-002:103). */
export const MAX_SLOTS_PER_CARD = 10;

/**
 * Локальное время слота в формате `YYYY-MM-DDTHH:mm`.
 *
 * Отдельная схема вместо `z.iso.datetime()`, потому что `z.iso.datetime()`
 * требует смещение, а здесь его нет by design.
 */
export const localSlotDateTimeSchema = z
  .string()
  .regex(
    LOCAL_DATE_TIME_REGEX,
    "Локальное время слота должно быть в формате YYYY-MM-DDTHH:mm",
  );

/**
 * [Request] Слот в составе анкеты (POST/PATCH /showcase).
 *
 * `durationMinutes` необязателен, и подстановку дефолта делает сервис:
 * значение по умолчанию — доменная константа матчмейкинга
 * (`MATCHMAKING_SLOT_DEFAULTS`), а не часть контракта запроса.
 */
export const showcaseSlotInputSchema = z.object({
  startsAtLocal: localSlotDateTimeSchema,
  durationMinutes: z
    .number()
    .int("Длительность слота должна быть целым числом минут")
    .min(
      SLOT_DURATION_LIMITS.MIN,
      `Минимальная длительность слота — ${SLOT_DURATION_LIMITS.MIN} минут`,
    )
    .max(
      SLOT_DURATION_LIMITS.MAX,
      `Максимальная длительность слота — ${SLOT_DURATION_LIMITS.MAX} минут`,
    )
    .optional(),
});

/**
 * [Request] Набор слотов анкеты.
 *
 * Пустой массив запрещён: «очистить расписание» и «расписания нет» — разные
 * намерения, и первое выражается отсутствием поля. Если слотов нет, поле просто
 * не присылается — так карточка без расписания остаётся допустимой (ADR-002:63).
 */
export const showcaseSlotsInputSchema = z
  .array(showcaseSlotInputSchema)
  .min(1, "Укажите хотя бы один слот")
  .max(MAX_SLOTS_PER_CARD, `Нельзя указать более ${MAX_SLOTS_PER_CARD} слотов`);

/** Статус слота (ADR-002:60). */
export const availabilitySlotStatusEnum = z.enum([
  "OPEN",
  "BOOKED",
  "CANCELLED",
]);

/**
 * [Response] Слот в составе карточки или заявки.
 *
 * `startsAt` — ISO-строка UTC-инстанта, а не локальное время: клиент
 * показывает его в зоне читателя (ADR-002:55), иначе одинаковый слот
 * отобразился бы разным текстом у автора и получателя.
 */
export const showcaseSlotResponseSchema = z.object({
  id: z.uuid(),
  startsAt: z.iso.datetime(),
  durationMinutes: z.number().int(),
  status: availabilitySlotStatusEnum,
});

export type ShowcaseSlotInputDto = z.infer<typeof showcaseSlotInputSchema>;
export type ShowcaseSlotsInputDto = z.infer<typeof showcaseSlotsInputSchema>;
export type ShowcaseSlotResponseDto = z.infer<
  typeof showcaseSlotResponseSchema
>;
export type AvailabilitySlotStatusDto = z.infer<
  typeof availabilitySlotStatusEnum
>;
