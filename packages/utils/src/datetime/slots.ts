import { TZDate } from "@date-fns/tz";

/**
 * Слоты доступности: перевод локального времени владельца в UTC-инстант и
 * проверка того, что этот момент существует (ADR-002:60, :65-66).
 *
 * Инстанты хранятся только в UTC, а локальное время — это то, что вводит
 * владелец карточки. Смещение в часах не хранится и не вычисляется (ADR-002:54),
 * поэтому единственная точка перехода между двумя формами — этот слой.
 */

/**
 * Локальное время слота в виде `YYYY-MM-DDTHH:mm`.
 *
 * Смещение намеренно не принимается: с ним на проводе нечего делать, а его
 * наличие означало бы, что клиент уже решил за владельца, в какой зоне слот.
 */
export const LOCAL_DATE_TIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

export interface LocalDateTime {
  year: number;
  /** Месяц 1-12, как в ISO 8601, а не 0-11, как в `Date`. */
  month: number;
  day: number;
  hours: number;
  minutes: number;
}

/** Причина, по которой локальное время не удалось превратить в инстант. */
export type LocalTimeRejection = "malformed" | "nonexistent";

export type LocalTimeResolution =
  | { ok: true; utc: Date }
  | { ok: false; reason: LocalTimeRejection };

function daysInMonth(year: number, month: number): number {
  // День 0 следующего месяца — последний день текущего: месяц не длиннее 31,
  // поэтому календарь UTC здесь ровно тот же, что и Gregorian.
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Разбирает строку локального времени в компоненты.
 *
 * Проверяется не только формат, но и существование даты: `2026-02-30` и
 * `2026-13-01` — это не даты, а опечатки, которые иначе молча превратились бы
 * в 2 марта и январь следующего года.
 */
export function parseLocalDateTime(
  value: string,
): LocalDateTime | LocalTimeRejection {
  const match = LOCAL_DATE_TIME_REGEX.exec(value);

  if (!match) {
    return "malformed";
  }

  const [, year, month, day, hours, minutes] = match;
  const parsed: LocalDateTime = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hours: Number(hours),
    minutes: Number(minutes),
  };

  const monthInRange = parsed.month >= 1 && parsed.month <= 12;
  const dayInRange =
    parsed.day >= 1 && parsed.day <= daysInMonth(parsed.year, parsed.month);
  const hoursInRange = parsed.hours >= 0 && parsed.hours <= 23;
  const minutesInRange = parsed.minutes >= 0 && parsed.minutes <= 59;

  if (!monthInRange || !dayInRange || !hoursInRange || !minutesInRange) {
    return "malformed";
  }

  return parsed;
}

function formatLocalDateTime(value: LocalDateTime): string {
  const pad = (part: number, length = 2): string =>
    String(part).padStart(length, "0");

  return [
    `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`,
    `T${pad(value.hours)}:${pad(value.minutes)}`,
  ].join("");
}

/**
 * Возвращает те же компоненты локального времени, что видит зона.
 *
 * Методы `TZDate` переопределены и читают компоненты в своей зоне, поэтому
 * результат — это ровно то, что покажет часы пользователя.
 */
function readZonedParts(instant: Date, timeZone: string): LocalDateTime {
  const zoned = new TZDate(instant.getTime(), timeZone);

  return {
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hours: zoned.getHours(),
    minutes: zoned.getMinutes(),
  };
}

/**
 * Переводит локальное время владельца в UTC-инстант.
 *
 * Возвращает `nonexistent`, если момента в этой зоне не существует: день
 * перехода на летнее время вырезает из суток интервал, и `TZDate` на таком
 * входе не бросает исключение, а молча сдвигает момент (ADR-002:66). Поэтому
 * проверка обязательна и выполняется round-trip'ом: обратное преобразование
 * обязано вернуть ровно то локальное время, которое запросили. Без round-trip'а
 * требование «момент существует в зоне владельца» осталось бы декларативным.
 *
 * Проверено на измеренном примере: `2011-03-27T02:30` в `Europe/Moscow`
 * разрешается в `03:30` (+04:00), то есть расхождение и есть сигнал.
 */
export function resolveLocalTimeToUtc(
  value: string,
  timeZone: string,
): LocalTimeResolution {
  const parsed = parseLocalDateTime(value);

  if (typeof parsed === "string") {
    return { ok: false, reason: parsed };
  }

  const resolved = new TZDate(
    parsed.year,
    parsed.month - 1,
    parsed.day,
    parsed.hours,
    parsed.minutes,
    timeZone,
  );

  const roundTripped = readZonedParts(resolved, timeZone);

  if (formatLocalDateTime(roundTripped) !== formatLocalDateTime(parsed)) {
    return { ok: false, reason: "nonexistent" };
  }

  return { ok: true, utc: new Date(resolved.getTime()) };
}

/** Конец интервала слота. Интервал полуоткрытый: `[startsAt, endsAt)`. */
export function slotEndsAt(startsAt: Date, durationMinutes: number): Date {
  return new Date(startsAt.getTime() + durationMinutes * 60 * 1000);
}

/**
 * Пересекаются ли два интервала слота.
 *
 * Сравнение полуоткрытое, то есть слот 19:00-20:00 не пересекается со слотом
 * 20:00-21:00: они граничат, и оба должны быть доступны.
 */
export function slotsOverlap(
  firstStart: Date,
  firstDurationMinutes: number,
  secondStart: Date,
  secondDurationMinutes: number,
): boolean {
  const firstEnd = slotEndsAt(firstStart, firstDurationMinutes).getTime();
  const secondEnd = slotEndsAt(secondStart, secondDurationMinutes).getTime();

  return firstStart.getTime() < secondEnd && secondStart.getTime() < firstEnd;
}

/** Локальное время инстанта в зоне — для показа в интерфейсе и проверок. */
export function utcToLocalDateTime(
  instant: Date,
  timeZone: string,
): LocalDateTime {
  return readZonedParts(instant, timeZone);
}
