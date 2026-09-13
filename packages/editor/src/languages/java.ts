import type { Monaco } from "@monaco-editor/react";
import type { languages } from "monaco-editor";

/**
 * Ключевые слова Java для базового автокомплита.
 */
const JAVA_KEYWORDS = [
  // Ключевые слова
  "public",
  "private",
  "protected",
  "static",
  "final",
  "abstract",
  "class",
  "interface",
  "extends",
  "implements",
  "enum",
  "void",
  "return",
  "new",
  "this",
  "super",
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
  "try",
  "catch",
  "finally",
  "throw",
  "throws",
  "import",
  "package",
  "synchronized",
  "volatile",
  "transient",
  "instanceof",
  "null",
  "true",
  "false",
  // Типы
  "int",
  "long",
  "short",
  "byte",
  "float",
  "double",
  "char",
  "boolean",
  "String",
  "Integer",
  "Long",
  "Double",
  "Boolean",
  "List",
  "Map",
  "Set",
  "ArrayList",
  "HashMap",
  "HashSet",
  "LinkedList",
  "TreeMap",
  // Часто используемые методы
  "System.out.println",
  "System.out.print",
  "Arrays.sort",
  "Arrays.asList",
  "Collections.sort",
  "Collections.reverse",
  "Math.max",
  "Math.min",
  "Math.abs",
];

let javaProviderRegistered = false;

/**
 * Регистрирует базовый автокомплит ключевых слов для Java.
 */
export function registerJavaCompletion(monaco: Monaco) {
  if (javaProviderRegistered) return;
  javaProviderRegistered = true;

  monaco.languages.registerCompletionItemProvider("java", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = JAVA_KEYWORDS.map(
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
