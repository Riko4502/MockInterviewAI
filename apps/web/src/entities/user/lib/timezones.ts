import { isResolvableTimeZone } from "@packages/utils";

/**
 * Утилиты выбора IANA-таймзоны для пикера (UI).
 *
 * `Intl.supportedValuesOf("timeZone")` здесь используется только для
 * наполнения списка в UI, а не как allowlist валидации (ADR-002:51).
 * Значение всё равно сохраняется как прислано и резолвится ICU.
 */

/** Элемент списка таймзон. */
export interface TimeZoneItem {
  /** IANA-идентификатор (например, `Europe/Moscow`). */
  id: string;
  /** Подпись (город, имя собственное). */
  label: string;
  /** Регион-группа (например, `Europe`). */
  region: string;
}

/** Группа таймзон по региону. */
export interface TimeZoneGroup {
  region: string;
  items: TimeZoneItem[];
}

/**
 * Минимальный практичный набор популярных зон (спека §4).
 * Показывается первым и служит фоллбэком, если `Intl.supportedValuesOf` недоступен.
 */
export const POPULAR_TIMEZONE_IDS: readonly string[] = [
  "UTC",
  "Europe/Moscow",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Kyiv",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Kolkata",
  "Asia/Dubai",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "America/Toronto",
  "America/Sao_Paulo",
  "Africa/Cairo",
  "Australia/Sydney",
];

/** Порядок регионов в списке (UTC и популярные — сверху). */
const REGION_ORDER: readonly string[] = [
  "UTC",
  "Europe",
  "Asia",
  "Africa",
  "America",
  "Australia",
  "Pacific",
  "Atlantic",
  "Indian",
  "Antarctica",
];

/** Нормализует регион в i18n-безопасный ключ (`America` → `america`). */
export function regionToKey(region: string): string {
  return region.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

/** Возвращает регион-группу по IANA-id. */
export function getTimeZoneRegion(id: string): string {
  if (id === "UTC") return "UTC";
  const [region] = id.split("/");
  if (!region) return "Other";
  return REGION_ORDER.includes(region) ? region : "Other";
}

/** Городская подпись из IANA-id (`America/New_York` → `New York`). */
export function getTimeZoneLabel(id: string): string {
  if (id === "UTC") return "UTC";
  const segments = id.split("/");
  const city = segments[segments.length - 1] ?? id;
  return city.replace(/_/g, " ");
}

/** Преобразует IANA-id в элемент списка. */
export function toTimeZoneItem(id: string): TimeZoneItem {
  return {
    id,
    label: getTimeZoneLabel(id),
    region: getTimeZoneRegion(id),
  };
}

/**
 * Возвращает текущую IANA-таймзону браузера.
 *
 * Используется для авто-подстановки таймзоны при первом входе/регистрации
 * (ADR-002:53) и кнопкой «Определить автоматически» в селекторе.
 *
 * @returns IANA-идентификатор либо `undefined`, если `Intl` недоступен.
 */
export function getBrowserTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Полный список зон: популярные + все канонические из ICU (если доступны).
 * Фоллбэк — только `POPULAR_TIMEZONE_IDS`.
 */
export function getAllTimeZoneIds(): string[] {
  const ids = new Set<string>(POPULAR_TIMEZONE_IDS);

  try {
    if (typeof Intl.supportedValuesOf === "function") {
      for (const id of Intl.supportedValuesOf("timeZone")) {
        ids.add(id);
      }
    }
  } catch {
    // some environments may throw; fall back to popular list
  }

  return [...ids].filter(isResolvableTimeZone);
}

/**
 * Строит плоский список таймзон, при необходимости дополняя его текущим
 * значением, чтобы выбранная зона всегда присутствовала в списке.
 */
export function buildTimeZoneList(currentId?: string): TimeZoneItem[] {
  const ids = getAllTimeZoneIds();

  if (
    currentId &&
    !ids.includes(currentId) &&
    isResolvableTimeZone(currentId)
  ) {
    ids.push(currentId);
  }

  return ids.map(toTimeZoneItem);
}

/** Группирует таймзоны по регионам и сортирует регионы/элементы. */
export function groupTimezones(items: TimeZoneItem[]): TimeZoneGroup[] {
  const groups = new Map<string, TimeZoneItem[]>();

  for (const item of items) {
    const bucket = groups.get(item.region);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(item.region, [item]);
    }
  }

  const regionRank = (region: string): number => {
    const index = REGION_ORDER.indexOf(region);
    return index === -1 ? REGION_ORDER.length : index;
  };

  return [...groups.entries()]
    .map(([region, regionItems]) => ({
      region,
      items: [...regionItems].sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .sort((a, b) => regionRank(a.region) - regionRank(b.region));
}
