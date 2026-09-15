import Editor, { loader, type Monaco } from "@monaco-editor/react";
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
import { registerThemes } from "@/themes";
import { DEFAULT_EDITOR_OPTIONS } from "./constants";
import type { CodeEditorProps } from "./types";

// Используем локальный пакет monaco-editor в браузере (безопасно для SSR)
if (typeof window !== "undefined") {
  import("monaco-editor").then((monaco) => {
    loader.config({ monaco });
    registerThemes(monaco);
  });
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value = "",
  onChange,
  language = "typescript",
  theme = "dark",
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

  // Синхронизируем тему при смене theme пропса в браузере
  useEffect(() => {
    if (typeof window !== "undefined") {
      import("monaco-editor").then((monaco) => {
        monaco.editor.setTheme(theme);
      });
    }
  }, [theme]);

  // Этот хук автоматически рисует чужие курсоры поверх кода
  useRemoteCursors(editorInstance, collaborators);

  // Вызывается ДО монтирования редактора.
  // Регистрируем темы и базовые сниппеты/ключевые слова для языков
  const handleBeforeMount = (monacoInstance: Monaco) => {
    registerThemes(monacoInstance);
    registerSqlCompletion(monacoInstance);
    registerPythonCompletion(monacoInstance);
    registerGoCompletion(monacoInstance);
    registerJavaCompletion(monacoInstance);
    registerCppCompletion(monacoInstance);
    registerRustCompletion(monacoInstance);

    // Поддержка современного стандарта ESNext
    monacoInstance.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      allowNonTextExtensions: true,
    });
    monacoInstance.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monacoInstance.languages.typescript.ScriptTarget.ESNext,
      allowNonTextExtensions: true,
    });
  };

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    _monaco: Monaco,
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
    <div className="w-full h-full relative">
      <Editor
        height="100%"
        language={language}
        theme={theme}
        value={value}
        onChange={(val) => onChange?.(val ?? "")}
        beforeMount={handleBeforeMount}
        onMount={handleEditorDidMount}
        loading={<div className="size-full animate-pulse bg-muted/20" />}
        options={mergedOptions}
      />
    </div>
  );
};
