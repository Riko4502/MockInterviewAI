import { defaultLocale, type Locale, locales } from "@packages/i18n";

/**
 * Нормализует языковой тег браузера в поддерживаемую приложением локаль (Locale).
 *
 * @param rawLocale - Необязательная строка локали (например, "ru-RU", "en-US").
 * Если не передана, считывается navigator.language при доступности в окружении.
 * @returns Поддерживаемая локаль ("ru" | "en"). Для неподдерживаемых/пустых значений возвращается defaultLocale ("ru").
 */
export function normalizeBrowserLocale(rawLocale?: string | null): Locale {
  const candidate =
    rawLocale !== undefined
      ? rawLocale
      : typeof navigator !== "undefined"
        ? navigator.language
        : undefined;

  if (!candidate || typeof candidate !== "string") {
    return defaultLocale;
  }

  const trimmed = candidate.trim();
  if (!trimmed) {
    return defaultLocale;
  }

  const primary = trimmed.toLowerCase().split(/[-_]/)[0];

  if ((locales as readonly string[]).includes(primary)) {
    return primary as Locale;
  }

  return defaultLocale;
}
