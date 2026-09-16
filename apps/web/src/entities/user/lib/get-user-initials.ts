/**
 * Собирает инициалы для заглушки аватара.
 * Берёт первые буквы имени и фамилии; если имени нет — первые символы email.
 * Если данных нет, возвращает «?».
 */
export function getUserInitials(
  name?: string | null,
  email?: string | null,
): string {
  const source = name?.trim() || email?.trim() || "";

  if (!source) {
    return "?";
  }

  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const second = parts[1]?.[0] ?? "";
    return `${first}${second}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}
