import Editor, { type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { LANGUAGE_CONFIGS } from "@/languages/config";
import { useRemoteCursors } from "@/multiplayer";
import { registerThemes } from "@/themes";
import { DEFAULT_EDITOR_OPTIONS } from "./constants";
import type { CodeEditorProps } from "./types";

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

  // Этот хук автоматически рисует чужие курсоры поверх кода
  useRemoteCursors(editorInstance, collaborators);

  // Вызывается ДО монтирования редактора.
  const handleBeforeMount = (monaco: Monaco) => {
    registerThemes(monaco);

    // Поддержка современного стандарта ESNext
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTextExtensions: true,
    });
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
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
        options={mergedOptions}
      />
    </div>
  );
};
