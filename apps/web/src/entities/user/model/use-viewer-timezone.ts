"use client";

import { getBrowserTimezone } from "../lib/timezones";
import { useCurrentUser } from "./use-current-user";

export interface UseViewerTimezoneOptions {
  /** Отключить запрос профиля (например, для неавторизованного экрана). */
  enabled?: boolean;
}

/**
 * Возвращает таймзону зрителя для отображения времени слотов
 * (ADR-002:43-49).
 *
 * Порядок приоритетов: сохранённая таймзона профиля → таймзона браузера → `UTC`.
 * Всегда возвращает валидную IANA-зону, поэтому вызывающий код может
 * форматировать время без дополнительных проверок.
 */
export function useViewerTimezone(options?: UseViewerTimezoneOptions): string {
  const { data: user } = useCurrentUser({ enabled: options?.enabled });
  return user?.timezone || getBrowserTimezone() || "UTC";
}
