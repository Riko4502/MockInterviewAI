/**
 * Общий доменный тип слота доступности (ADR-002).
 *
 * Единственный источник формы слота для UI. В `@packages/api` Orval генерирует
 * контекстные типы (`ShowcaseCardResponseDtoSlotsItem`,
 * `MatchRequestResponseDtoSlot`, `PaginatedShowcaseCardsDtoDataItemSlotsItem`,
 * ...), структурно идентичные этому. Локальные дублирующие интерфейсы слотов
 * создавать нельзя — брать `AvailabilitySlot` отсюда.
 */

/** Статус слота доступности. */
export type AvailabilitySlotStatus = "OPEN" | "BOOKED" | "CANCELLED";

/**
 * Слот доступности в ответах API.
 *
 * `startsAt` — UTC-инстант ISO-8601; печатать его в UI можно только через
 * `formatInstantInTimeZone` из `@packages/utils` в таймзоне смотрящего.
 */
export interface AvailabilitySlot {
  id: string;
  /** UTC-инстант начала слота (ISO-8601, с суффиксом `Z`). */
  startsAt: string;
  /** Длительность слота в минутах. */
  durationMinutes: number;
  status: AvailabilitySlotStatus;
}
