/**
 * Поддерживаемые языки программирования в редакторе.
 */
export type LanguageId =
  | "typescript"
  | "javascript"
  | "python"
  | "go"
  | "java"
  | "cpp"
  | "rust"
  | "sql";

/**
 * Конфигурация конкретного языка для Monaco Editor.
 * Используется для настройки отступов (табы/пробелы) в зависимости от стандартов языка.
 */
export interface LanguageConfig {
  /** Идентификатор языка (понятный для Monaco) */
  id: LanguageId;
  /** Человекочитаемое название для UI (например, для дропдауна выбора языка) */
  label: string;
  /** Количество пробелов на один Tab */
  tabSize: number;
  /** Использовать ли пробелы вместо реальных символов табуляции */
  insertSpaces: boolean;
}

/**
 * Словарь настроек для каждого поддерживаемого языка.
 * Используется для конфигурации редактора при переключении языка пользователем.
 */
export const LANGUAGE_CONFIGS: Record<LanguageId, LanguageConfig> = {
  typescript: {
    id: "typescript",
    label: "TypeScript",
    tabSize: 2,
    insertSpaces: true,
  },
  javascript: {
    id: "javascript",
    label: "JavaScript",
    tabSize: 2,
    insertSpaces: true,
  },
  python: { id: "python", label: "Python", tabSize: 4, insertSpaces: true },
  go: { id: "go", label: "Go", tabSize: 4, insertSpaces: false }, // В Go традиционно используются табы, а не пробелы
  java: { id: "java", label: "Java", tabSize: 4, insertSpaces: true },
  cpp: { id: "cpp", label: "C++", tabSize: 4, insertSpaces: true },
  rust: { id: "rust", label: "Rust", tabSize: 4, insertSpaces: true },
  sql: { id: "sql", label: "SQL", tabSize: 2, insertSpaces: true },
};
