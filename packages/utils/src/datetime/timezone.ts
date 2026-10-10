/**
 * Валидация IANA-таймзон (ADR-002:47-52).
 *
 * Проверка двухшаговая, и это не избыточность: начиная с ES2024
 * `Intl.DateTimeFormat` принимает offset-таймзоны (`+04:00`, `-0730`) как
 * валидные зоны. Без шага с форматом в `User.timezone` попал бы фиксированный
 * сдвиг, а это прямо нарушает правило «смещение не хранится» и приводит к
 * `RangeError` при рендере с токеном `z`.
 *
 * Allowlist через `Intl.supportedValuesOf("timeZone")` запрещён (ADR-002:51):
 * список зависит от версии ICU рантайма, содержит устаревшие ссылки и не
 * содержит актуальных канонических идентификаторов, то есть контрактом не
 * является. Единственный источник правил переходов — ICU рантайма.
 */

/** Формат IANA-идентификатора: `Etc/GMT+5`, `America/Argentina/Buenos_Aires`. */
export const IANA_TIME_ZONE_REGEX =
  /^[A-Za-z][A-Za-z0-9_+-]*(?:\/[A-Za-z0-9_+-]+){1,2}$/;

/**
 * Ограничение длины таймзоны.
 *
 * 64 символа с запасом перекрывают самый длинный реальный идентификатор
 * (`America/Argentina/ComodRivadavia` — 32), поэтому ограничение отсекает
 * мусор, а не валидные значения.
 */
export const MAX_TIME_ZONE_LENGTH = 64;

/**
 * Причина отказа. Различение нужно вызывающему коду: форматная ошибка —
 * это опечатка в запросе (`Europe/Moscow` без слеша), а нерезолвимость —
 * это устаревшая или выдуманная зона.
 */
export type TimeZoneRejection = "too_long" | "format" | "unresolvable";

/** Шаг 1 — формат IANA-идентификатора. `UTC` допускается отдельно. */
export function isIanaTimeZoneFormat(value: string): boolean {
  return value === "UTC" || IANA_TIME_ZONE_REGEX.test(value);
}

/**
 * Шаг 2 — резолвимость зоны рантаймом.
 *
 * Единственная доступная проверка: базы таймзон нет ни в `@date-fns/tz`, ни в
 * `Intl`, они берутся из ICU, поэтому спрашивать надо сам ICU.
 */
export function isResolvableTimeZone(value: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * Полная двухшаговая проверка таймзоны.
 *
 * @returns `null`, если значение можно сохранять, иначе причину отказа.
 */
export function getTimeZoneRejection(value: string): TimeZoneRejection | null {
  if (value.length > MAX_TIME_ZONE_LENGTH) {
    return "too_long";
  }

  if (!isIanaTimeZoneFormat(value)) {
    return "format";
  }

  if (!isResolvableTimeZone(value)) {
    return "unresolvable";
  }

  return null;
}

/** true, если таймзону можно сохранить в `User.timezone`. */
export function isValidTimeZone(value: string): boolean {
  return getTimeZoneRejection(value) === null;
}
