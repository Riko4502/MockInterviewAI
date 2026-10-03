import { tz } from "@date-fns/tz";
import { format } from "date-fns";

/**
 * Форматирование инстанта в зоне читателя (ADR-002:55, :99).
 *
 * Вызов `format(date, ...)` без зоны запрещён: в контейнере API системная зона —
 * UTC, в браузере — зона пользователя, поэтому такой вызов даёт расхождение
 * между серверным и клиентским рендером в одном и том же тексте.
 */

/** Формат по умолчанию: минуты нужны, секунды в расписании встреч — нет. */
export const DEFAULT_INSTANT_PATTERN = "yyyy-MM-dd HH:mm";

/**
 * Печатает UTC-инстант в зоне получателя.
 *
 * @param instant - UTC-инстант (`Date` или ISO-строка)
 * @param timeZone - IANA-зона читателя
 * @param pattern - паттерн date-fns, по умолчанию `yyyy-MM-dd HH:mm`
 */
export function formatInstantInTimeZone(
  instant: Date | string,
  timeZone: string,
  pattern: string = DEFAULT_INSTANT_PATTERN,
): string {
  const date = typeof instant === "string" ? new Date(instant) : instant;

  return format(date, pattern, { in: tz(timeZone) });
}
