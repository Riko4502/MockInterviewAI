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

/**
 * Опции форматирования даты и времени через `Intl.DateTimeFormat`.
 */
export interface FormatDateTimeOptions {
  /** IANA часовой пояс (по умолчанию "UTC" для гарантии одинакового рендеринга на сервере и клиенте) */
  timeZone?: string;
  /** Локаль (по умолчанию "ru-RU") */
  locale?: string;
  /** Включать ли часы и минуты в форматированную строку (по умолчанию true) */
  includeTime?: boolean;
}

/**
 * Безопасное форматирование даты и времени в фиксированном часовом поясе.
 * Предотвращает расхождения SSR-гидратации между сервером (Node.js UTC) и клиентом.
 *
 * @param date - Date, ISO-строка, timestamp или null/undefined
 * @param options - параметры часового пояса, локали и отображения времени
 * @returns Отформатированная дата (например "15.02.2026, 10:00") или "—" при отсутствии значения.
 */
export function formatDateTime(
  date: Date | string | number | null | undefined,
  options?: FormatDateTimeOptions,
): string {
  if (!date) return "—";

  try {
    const d = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(d.getTime())) return "—";

    const {
      timeZone = "UTC",
      locale = "ru-RU",
      includeTime = true,
    } = options ?? {};

    const formatOptions: Intl.DateTimeFormatOptions = {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone,
    };

    if (includeTime) {
      formatOptions.hour = "2-digit";
      formatOptions.minute = "2-digit";
    }

    return new Intl.DateTimeFormat(locale, formatOptions).format(d);
  } catch {
    return String(date);
  }
}
