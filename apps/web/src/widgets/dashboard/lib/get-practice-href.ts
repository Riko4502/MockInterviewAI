import { paths } from "@/shared/config";

// Для практики допустим только существующий маршрут песочницы. Сохраняем серверный контекст.
export function getPracticeHref(value?: string): string | null {
  if (!value || !value.startsWith(`${paths.sandbox}?`)) return null;
  try {
    const url = new URL(value, "https://dashboard.invalid");
    if (
      url.origin !== "https://dashboard.invalid" ||
      url.pathname !== paths.sandbox
    )
      return null;
    if (
      !url.searchParams.get("problemId")?.trim() &&
      !url.searchParams.get("topic")?.trim()
    )
      return null;
    return `${paths.sandbox}${url.search}`;
  } catch {
    return null;
  }
}
