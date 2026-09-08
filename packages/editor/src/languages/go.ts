import type { Monaco } from "@monaco-editor/react";
import type { languages } from "monaco-editor";

/**
 * Ключевые слова Go для базового автокомплита.
 */
const GO_KEYWORDS = [
  // Ключевые слова
  "func",
  "return",
  "package",
  "import",
  "var",
  "const",
  "type",
  "struct",
  "interface",
  "if",
  "else",
  "for",
  "range",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "goto",
  "fallthrough",
  "defer",
  "go",
  "select",
  "chan",
  "map",
  "make",
  "new",
  "append",
  "len",
  "cap",
  "nil",
  "true",
  "false",
  "iota",
  // Типы
  "string",
  "int",
  "int8",
  "int16",
  "int32",
  "int64",
  "uint",
  "uint8",
  "uint16",
  "uint32",
  "uint64",
  "float32",
  "float64",
  "bool",
  "byte",
  "rune",
  "error",
  // Встроенные функции
  "fmt.Println",
  "fmt.Printf",
  "fmt.Sprintf",
  "panic",
  "recover",
  "close",
  "delete",
  "copy",
];

let goProviderRegistered = false;

/**
 * Регистрирует базовый автокомплит ключевых слов для Go.
 */
export function registerGoCompletion(monaco: Monaco) {
  if (goProviderRegistered) return;
  goProviderRegistered = true;

  monaco.languages.registerCompletionItemProvider("go", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = GO_KEYWORDS.map(
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
