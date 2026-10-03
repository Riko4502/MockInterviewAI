import type { Locale } from "@packages/i18n";

export function formatDuration(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

// Явный часовой пояс обеспечивает одинаковый рендеринг на сервере и клиенте.
export function formatDashboardDate(
  value: string | Date,
  locale: Locale,
  timeZone: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone,
  }).format(date);
}

export function formatDashboardTime(
  value: string | Date,
  locale: Locale,
  timeZone: string,
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(date);
}
