import type { Monaco } from "@monaco-editor/react";
import type { languages } from "monaco-editor";

/**
 * Базовый набор ключевых слов SQL для автокомплита.
 * В текущей версии мы не анализируем схему БД, поэтому даём только подсветку синтаксиса.
 */
const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "INSERT",
  "UPDATE",
  "DELETE",
  "CREATE",
  "ALTER",
  "DROP",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "UNION",
  "EXISTS",
  "IN",
  "BETWEEN",
  "LIKE",
  "IS NULL",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
  "AS",
  "ON",
  "SET",
  "VALUES",
  "INTO",
  "DISTINCT",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
];

// Флаг-предохранитель, чтобы не регистрировать провайдер автокомплита дважды (например, при ре-рендерах React)
let sqlProviderRegistered = false;

/**
 * Регистрирует кастомный провайдер автокомплита (IntelliSense) для SQL.
 * Monaco Editor будет вызывать этот провайдер каждый раз, когда пользователь
 * печатает текст в редакторе в режиме "sql".
 *
 * @param monaco - Инстанс Monaco Editor
 */
export function registerSqlCompletion(monaco: Monaco) {
  if (sqlProviderRegistered) return;
  sqlProviderRegistered = true;

  // Регистрируем CompletionItemProvider для языка 'sql'
  monaco.languages.registerCompletionItemProvider("sql", {
    provideCompletionItems: (model, position) => {
      // Получаем слово, которое пользователь сейчас печатает
      const word = model.getWordUntilPosition(position);

      // Вычисляем диапазон (строки и колонки) текста, который будет заменен автокомплитом
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      // Формируем список подсказок из нашего массива ключевых слов SQL
      const suggestions: languages.CompletionItem[] = SQL_KEYWORDS.map(
        (keyword) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword, // Добавит красивую иконку "Ключевое слово" в списке
          insertText: keyword, // Текст, который вставится в редактор при нажатии Enter/Tab
          range,
        }),
      );

      return { suggestions };
    },
  });
}
