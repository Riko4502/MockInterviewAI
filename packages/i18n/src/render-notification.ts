import { getMessages } from "./messages";

/**
 * Единственная функция рендера текста уведомления (ADR-003:59).
 *
 * Её зовут и in-app-путь, и бот, поэтому тексты живут здесь, а не собираются
 * на стороне канала: одна строка означала бы, что in-app и Telegram неизбежно
 * разойдутся (ADR-003:41).
 *
 * Пакет сознательно остаётся без зависимостей, поэтому интерполяция и вывод
 * даты написаны здесь, а не взяты из i18next.
 */

export interface RenderNotificationOptions {
  /** Локаль получателя. Неизвестная локаль откатывается на локаль по умолчанию. */
  locale: string;
  /**
   * Часовой пояс читателя. Без него UTC-инстант выводится в зоне рантайма,
   * поэтому передавать его нужно всегда, когда текст содержит время.
   */
  timeZone?: string;
  /** Опорный момент для относительных дат. */
  now?: Date;
}

export interface RenderedNotification {
  title: string;
  message: string;
}

const ISO_INSTANT =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

/**
 * Правило вывода времени одно на все события, а не отдельное на каждое:
 * любой UTC-инстант в payload показывается в зоне читателя. Именно этого
 * требует ADR-002:55 — без этого расписание нельзя показать в зоне того, кто
 * его читает.
 */
function formatInstant(
  value: string,
  locale: string,
  timeZone: string | undefined,
): string {
  const instant = new Date(value);

  if (Number.isNaN(instant.getTime())) {
    return value;
  }

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      ...(timeZone ? { timeZone } : {}),
    }).format(instant);
  } catch {
    // Неизвестная зона IANA не должна ронять доставку уведомления.
    return instant.toISOString();
  }
}

function resolveValue(
  value: unknown,
  locale: string,
  timeZone: string | undefined,
): string {
  if (typeof value === "string") {
    return ISO_INSTANT.test(value)
      ? formatInstant(value, locale, timeZone)
      : value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function interpolate(
  template: string,
  payload: Record<string, unknown>,
  locale: string,
  timeZone: string | undefined,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!(key in payload)) {
      return match;
    }

    return resolveValue(payload[key], locale, timeZone);
  });
}

/**
 * Рендерит заголовок и текст уведомления по типу события.
 *
 * Неизвестный тип не считается ошибкой: событие может прийти из бота или из
 * более новой версии сервиса раньше, чем обновится этот пакет, и молчащий
 * пропуск уведомления хуже нейтрального заглушечного текста.
 */
export function renderNotification(
  type: string,
  payload: Record<string, unknown>,
  options: RenderNotificationOptions,
): RenderedNotification {
  const { notifications } = getMessages(options.locale);
  const template =
    notifications.events[type as keyof typeof notifications.events];

  const resolved = template ?? notifications.fallback;

  return {
    title: interpolate(
      resolved.title,
      payload,
      options.locale,
      options.timeZone,
    ),
    message: interpolate(
      resolved.message,
      payload,
      options.locale,
      options.timeZone,
    ),
  };
}
