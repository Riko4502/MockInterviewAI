import {
  defaultLocale,
  getMessages,
  type Locale,
  type TelegramMessages,
} from "@packages/i18n";

/**
 * Определяет локаль пользователя по приоритету SPEC §10.2:
 *
 * 1. Явный выбор (`/lang`) — `manual`;
 * 2. Персистентная локаль профиля (`telegramLocale`) — `profileLocale`;
 * 3. Автоопределение по `language_code` из Telegram API: префикс `ru` → `ru`,
 *    все остальные языки (включая `uk`, `kk`) → `en`;
 * 4. Фоллбэк — `defaultLocale` пакета (`ru`) при отсутствии `language_code`.
 *
 * Некорректные значения `manual`/`profileLocale` игнорируются и не
 * прерывают цепочку разрешения.
 *
 * @param manual - Локаль из сессии грамми (`ctx.session.locale`).
 * @param profileLocale - Локаль профиля из API (`telegramLocale`).
 * @param languageCode - `ctx.from.language_code` из Telegram.
 * @returns Разрешённая локаль (`ru` | `en`).
 */
export function resolveLocale(
  manual?: string | null,
  profileLocale?: string | null,
  languageCode?: string | null,
): Locale {
  if (manual === "ru" || manual === "en") return manual;
  if (profileLocale === "ru" || profileLocale === "en") return profileLocale;
  if (
    languageCode === undefined ||
    languageCode === null ||
    languageCode === ""
  ) {
    return defaultLocale;
  }
  return languageCode.startsWith("ru") ? "ru" : "en";
}

/**
 * Возвращает переведённую строку из словаря `telegram.json`.
 *
 * Устаревшее/невалидное значение (не строка) или отсутствующий ключ —
 * возвращается как есть без падения (SPEC §10.3, деградация).
 *
 * @param locale - Локаль (`ru` | `en`).
 * @param key - Путь к ключу с точками, например `start.welcome`.
 * @param vars - Значения для интерполяции `{{name}}` (например `{ shortId }`).
 * @returns Перевод, либо исходный ключ при отсутствии перевода.
 */
export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const messages: TelegramMessages = getMessages(locale).telegram;
  const value = key
    .split(".")
    .reduce<unknown>(
      (acc, part) => (acc as Record<string, unknown> | undefined)?.[part],
      messages,
    );
  if (typeof value !== "string") return key;
  if (vars === undefined) return value;
  return value.replace(/\{\{(\w+)\}\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}
