import { formatInstantInTimeZone } from "@packages/utils";

const SLOT_INTERVAL_PATTERN = "d MMMM, HH:mm";
const SLOT_END_PATTERN = "HH:mm";
const MINUTES_TO_MS = 60 * 1000;

/**
 * Форматирует интервал слота (начало + длительность) в таймзоне смотрящего.
 *
 * Показывает начало и вычисленный конец без текстовых единиц измерения, поэтому
 * результат не требует i18n-ключа: `15 января, 19:00 – 20:00`.
 *
 * @param instant - UTC-инстант начала слота (`Date` или ISO-строка)
 * @param tz - IANA-таймзона смотрящего
 * @param duration - длительность слота в минутах
 * @param locale - локаль названий месяца/дня (`"ru"` / `"en"`); по умолчанию `"en"`
 */
export function formatCardSlot(
  instant: Date | string,
  tz: string,
  duration: number,
  locale: string = "en",
): string {
  const start = typeof instant === "string" ? new Date(instant) : instant;
  const end = new Date(start.getTime() + duration * MINUTES_TO_MS);

  const startLabel = formatInstantInTimeZone(
    start,
    tz,
    SLOT_INTERVAL_PATTERN,
    locale,
  );
  const endLabel = formatInstantInTimeZone(end, tz, SLOT_END_PATTERN, locale);

  return `${startLabel} – ${endLabel}`;
}
