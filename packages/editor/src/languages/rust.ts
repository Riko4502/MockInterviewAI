import type { Monaco } from "@monaco-editor/react";
import type { languages } from "monaco-editor";

/**
 * Ключевые слова Rust для базового автокомплита.
 */
const RUST_KEYWORDS = [
  // Ключевые слова
  "fn",
  "let",
  "mut",
  "const",
  "static",
  "struct",
  "enum",
  "impl",
  "trait",
  "type",
  "pub",
  "self",
  "super",
  "crate",
  "mod",
  "use",
  "return",
  "if",
  "else",
  "match",
  "loop",
  "while",
  "for",
  "in",
  "break",
  "continue",
  "where",
  "as",
  "ref",
  "move",
  "async",
  "await",
  "unsafe",
  "extern",
  "true",
  "false",
  // Типы
  "i8",
  "i16",
  "i32",
  "i64",
  "i128",
  "isize",
  "u8",
  "u16",
  "u32",
  "u64",
  "u128",
  "usize",
  "f32",
  "f64",
  "bool",
  "char",
  "String",
  "str",
  "Vec",
  "Box",
  "Option",
  "Result",
  "HashMap",
  "HashSet",
  "BTreeMap",
  "BTreeSet",
  "Some",
  "None",
  "Ok",
  "Err",
  // Макросы и функции
  "println!",
  "print!",
  "format!",
  "vec!",
  "todo!",
  "unimplemented!",
  "panic!",
  "unwrap",
  "expect",
  "clone",
  "iter",
  "map",
  "filter",
  "collect",
  "fold",
  "push",
  "pop",
  "len",
  "is_empty",
];

let rustProviderRegistered = false;

/**
 * Регистрирует базовый автокомплит ключевых слов для Rust.
 */
export function registerRustCompletion(monaco: Monaco) {
  if (rustProviderRegistered) return;
  rustProviderRegistered = true;

  monaco.languages.registerCompletionItemProvider("rust", {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: languages.CompletionItem[] = RUST_KEYWORDS.map(
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
