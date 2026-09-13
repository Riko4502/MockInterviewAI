import type { LanguageId } from "@/languages/config";

/**
 * Стартовые шаблоны для SQL-задач (написание запросов к БД).
 */
export const SQL_TEMPLATES: Partial<Record<LanguageId, string>> = {
  sql: `-- Напишите ваш SQL-запрос ниже\nSELECT * FROM users;\n`,
};
