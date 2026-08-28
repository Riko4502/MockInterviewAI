/**
 * Нормализует email: обрезает пробелы и приводит к нижнему регистру.
 *
 * @param input - Исходная строка email.
 * @returns Нормализованный email.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
