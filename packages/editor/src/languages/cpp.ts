import type { Monaco } from "@monaco-editor/react";
import type { languages } from "monaco-editor";

/**
 * Ключевые слова C++ для базового автокомплита.
 */
const CPP_KEYWORDS = [
  // Ключевые слова
  "include",
  "using",
  "namespace",
  "std",
  "class",
  "struct",
  "enum",
  "union",
  "template",
  "typename",
  "public",
  "private",
  "protected",
  "virtual",
  "override",
  "final",
  "void",
  "return",
  "new",
  "delete",
  "this",
  "nullptr",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "goto",
  "try",
  "catch",
  "throw",
  "const",
  "static",
  "inline",
  "constexpr",
  "auto",
  "typedef",
  "sizeof",
  "true",
  "false",
  // Типы
  "int",
  "long",
  "short",
  "char",
  "float",
  "double",
  "bool",
  "string",
  "vector",
  "map",
  "set",
  "unordered_map",
  "unordered_set",
  "pair",
  "queue",
  "stack",
  "deque",
  "priority_queue",
  "array",
  "list",
  "bitset",
  // Часто используемые функции
  "cout",
  "cin",
  "endl",
  "sort",
  "reverse",
  "find",
  "count",
  "push_back",
  "pop_back",
  "begin",
  "end",
  "size",
  "empty",
  "insert",
  "erase",
  "min",
  "max",
  "abs",
  "swap",
];

let cppProviderRegistered = false;

/**
 * Регистрирует базовый автокомплит ключевых слов для C++.
 */
export function registerCppCompletion(monaco: Monaco) {
  if (cppProviderRegistered) return;
  cppProviderRegistered = true;

  monaco.languages.registerCompletionItemProvider("cpp", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = CPP_KEYWORDS.map(
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
