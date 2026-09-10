import type { LanguageId } from "@/languages/config";
import { ALGORITHM_TEMPLATES } from "./algorithm";
import { SQL_TEMPLATES } from "./sql";

/** Категории задач, определяющие какой набор шаблонов использовать */
export type TaskCategory = "algorithm" | "sql";

/**
 * Возвращает стартовый шаблон кода для выбранного языка и категории задачи.
 *
 * Пакет просто экспортирует чистую функцию-утилиту.
 * Приложение (apps/web) само решает, когда её вызывать (например, при создании комнаты
 * в браузере или когда поле кода изначально пустое).
 * Наш пакет @packages/editor не встраивает этот код самостоятельно, он только предоставляет API.
 *
 * @param language - Выбранный язык программирования (например, 'typescript')
 * @param category - Категория задачи ('algorithm' или 'sql')
 * @returns Строка с начальным кодом или пустая строка, если шаблон для языка не найден
 */
export function getTemplate(
  language: LanguageId,
  category: TaskCategory,
): string {
  if (category === "algorithm") {
    return ALGORITHM_TEMPLATES[language] ?? "";
  }

  if (category === "sql") {
    return SQL_TEMPLATES[language] ?? "";
  }

  return "";
}
