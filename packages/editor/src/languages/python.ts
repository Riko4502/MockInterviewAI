import type { Monaco } from "@monaco-editor/react";
import type { languages } from "monaco-editor";

/**
 * Ключевые слова Python для базового автокомплита.
 * Включает встроенные функции, ключевые слова управления потоком и типы данных.
 */
const PYTHON_KEYWORDS = [
  // Ключевые слова управления потоком
  "def",
  "class",
  "return",
  "yield",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "break",
  "continue",
  "try",
  "except",
  "finally",
  "raise",
  "with",
  "as",
  "import",
  "from",
  "pass",
  "lambda",
  "and",
  "or",
  "not",
  "is",
  "in",
  "True",
  "False",
  "None",
  "global",
  "nonlocal",
  "assert",
  "del",
  "async",
  "await",
  // Встроенные функции (builtins)
  "print",
  "len",
  "range",
  "enumerate",
  "zip",
  "map",
  "filter",
  "sorted",
  "reversed",
  "list",
  "dict",
  "set",
  "tuple",
  "str",
  "int",
  "float",
  "bool",
  "isinstance",
  "type",
  "super",
  "property",
  "staticmethod",
  "classmethod",
  "input",
  "open",
  "abs",
  "sum",
  "min",
  "max",
  "any",
  "all",
  "hasattr",
  "getattr",
  "setattr",
];

let pythonProviderRegistered = false;

/**
 * Регистрирует базовый автокомплит ключевых слов для Python.
 * Подсказывает ключевые слова языка и встроенные функции (builtins).
 */
export function registerPythonCompletion(monaco: Monaco) {
  if (pythonProviderRegistered) return;
  pythonProviderRegistered = true;

  monaco.languages.registerCompletionItemProvider("python", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = PYTHON_KEYWORDS.map(
        (keyword) => ({
          label: keyword,
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: keyword,
          range,
        }),
      );

      return { suggestions };
    },
  });
}
