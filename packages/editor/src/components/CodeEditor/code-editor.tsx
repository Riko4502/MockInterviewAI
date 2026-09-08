import Editor from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import {
  registerCppCompletion,
  registerGoCompletion,
  registerJavaCompletion,
  registerPythonCompletion,
  registerRustCompletion,
  registerSqlCompletion,
} from "@/languages";
import { LANGUAGE_CONFIGS } from "@/languages/config";
import { useRemoteCursors } from "@/multiplayer";
import { MOCKINTERVIEW_DARK_THEME_ID, registerThemes } from "@/themes";
import { DEFAULT_EDITOR_OPTIONS } from "./constants";
import type { CodeEditorProps } from "./types";

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language = "typescript",
  theme = MOCKINTERVIEW_DARK_THEME_ID,
  readOnly = false,
  collaborators = [],
  onCursorChange,
  cursorThrottleMs = 50,
  options = {},
}) => {
  // Сохраняем инстанс в state, чтобы хук useRemoteCursors получил его после onMount
  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Этот хук автоматически рисует чужие курсоры поверх кода
  useRemoteCursors(editorInstance, collaborators);

  // Вызывается ДО монтирования редактора.
  // Регистрируем тему и автокомплит для всех языков кроме TS/JS
  // (у них полноценный IntelliSense из коробки).
  const handleBeforeMount = (monaco: typeof import("monaco-editor")) => {
    registerThemes(monaco);
    registerSqlCompletion(monaco);
    registerPythonCompletion(monaco);
    registerGoCompletion(monaco);
    registerJavaCompletion(monaco);
    registerCppCompletion(monaco);
    registerRustCompletion(monaco);
  };

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    _monacoInstance: typeof import("monaco-editor"),
  ) => {
    setEditorInstance(editor);

    editor.onDidChangeCursorPosition((e) => {
      if (!onCursorChange) return;

      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }

      throttleTimerRef.current = setTimeout(() => {
        const selection = editor.getSelection();

        onCursorChange({
          line: e.position.lineNumber,
          column: e.position.column,
          selectionEndLine: selection?.selectionStartLineNumber,
          selectionEndColumn: selection?.selectionStartColumn,
        });
      }, cursorThrottleMs);
    });
  };

  useEffect(() => {
    return () => {
      if (throttleTimerRef.current) {
        clearTimeout(throttleTimerRef.current);
      }
    };
  }, []);

  const mergedOptions = {
    ...DEFAULT_EDITOR_OPTIONS,
    readOnly,
    ...options,
  };

  // Получаем специфичные настройки отступов для выбранного языка
  if (language) {
    const langConfig =
      LANGUAGE_CONFIGS[language as keyof typeof LANGUAGE_CONFIGS];
    if (langConfig) {
      mergedOptions.tabSize = langConfig.tabSize;
      mergedOptions.insertSpaces = langConfig.insertSpaces;
    }
  }

  return (
    <div className="w-full h-full min-h-[400px] border border-[var(--border)] rounded-md overflow-hidden relative">
      <Editor
        height="100%"
        language={language}
        theme={theme}
        value={value}
        onChange={(val) => onChange?.(val ?? "")}
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        options={mergedOptions}
      />
    </div>
  );
};

// Для полного отключения автокомплита передать в props -
// options={{
//   quickSuggestions: false, // Отключает автоматические подсказки при наборе
//     suggestOnTriggerCharacters: false, // Отключает подсказки при вводе "." и т.д.
//     parameterHints: { enabled: false }, // Отключает подсказки параметров функций
// }}
