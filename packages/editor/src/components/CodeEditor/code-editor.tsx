import Editor, { loader, type Monaco } from "@monaco-editor/react";
import type { editor } from "monaco-editor";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { MonacoBinding } from "y-monaco";
import * as Y from "yjs";
import {
  registerCppCompletion,
  registerGoCompletion,
  registerJavaCompletion,
  registerPythonCompletion,
  registerRustCompletion,
  registerSqlCompletion,
} from "@/languages";
import { LANGUAGE_CONFIGS } from "@/languages/config";
import {
  removeYjsAwarenessStyles,
  updateYjsAwarenessStyles,
} from "@/multiplayer";
import { registerThemes } from "@/themes";
import { DEFAULT_EDITOR_OPTIONS } from "./constants";
import type { CodeEditorProps } from "./types";

let monacoInitPromise: Promise<typeof import("monaco-editor")> | null = null;

/**
 * Инициализирует Monaco Editor в браузере, конфигурируя loader локальным пакетом до монтирования редактора.
 */
export function initMonaco(): Promise<typeof import("monaco-editor")> {
  if (typeof window === "undefined") {
    return Promise.resolve({} as typeof import("monaco-editor"));
  }
  if (!monacoInitPromise) {
    monacoInitPromise = import("monaco-editor").then((monaco) => {
      loader.config({ monaco });
      registerThemes(monaco);
      return monaco;
    });
  }
  return monacoInitPromise;
}

// Запускаем предварительную инициализацию в браузере
if (typeof window !== "undefined") {
  void initMonaco();
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value = "",
  onChange,
  language = "typescript",
  theme = "dark",
  readOnly = false,
  onCursorChange,
  cursorThrottleMs = 50,
  options = {},
  yText,
  awareness,
  undoManager: externalUndoManager,
  onUndoManagerInit,
}) => {
  const [isMonacoReady, setIsMonacoReady] = useState(false);

  const [editorInstance, setEditorInstance] =
    useState<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const throttleTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    let isMounted = true;
    initMonaco().then(() => {
      if (isMounted) {
        setIsMonacoReady(true);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  // Синхронизируем тему при смене theme пропса в браузере
  useEffect(() => {
    if (typeof window !== "undefined" && isMonacoReady) {
      initMonaco().then((monaco) => {
        monaco.editor.setTheme(theme);
      });
    }
  }, [theme, isMonacoReady]);

  // Инъекция динамических CSS стилей курсоров и бейджей соавторов Yjs Awareness (T021)
  useEffect(() => {
    if (!awareness) return;
    updateYjsAwarenessStyles(awareness);
    const handleAwarenessChange = () => {
      updateYjsAwarenessStyles(awareness);
    };
    awareness.on("change", handleAwarenessChange);
    return () => {
      awareness.off("change", handleAwarenessChange);
      removeYjsAwarenessStyles(awareness);
    };
  }, [awareness]);

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

    // Отключаем фоновую валидацию через воркеры по умолчанию во избежание Unexpected usage
    monacoInstance.languages.typescript.typescriptDefaults.setDiagnosticsOptions(
      {
        noSemanticValidation: true,
        noSyntaxValidation: true,
      },
    );
    monacoInstance.languages.typescript.javascriptDefaults.setDiagnosticsOptions(
      {
        noSemanticValidation: true,
        noSyntaxValidation: true,
      },
    );
  };

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monacoInstance: Monaco,
  ) => {
    monacoRef.current = monacoInstance;
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

  // Интеграция Yjs + MonacoBinding + UndoManager (Phase 3: T015)
  useEffect(() => {
    if (!editorInstance || !yText) {
      return;
    }

    const model = editorInstance.getModel();
    if (!model) {
      return;
    }

    // Перехватываем подписку на onDidChangeCursorSelection через Proxy, чтобы освободить её при destroy (leak fix в y-monaco)
    const disposables: { dispose: () => void }[] = [];
    const editorProxy = new Proxy(editorInstance, {
      get(target, prop, receiver) {
        if (prop === "onDidChangeCursorSelection") {
          return (
            listener: Parameters<typeof target.onDidChangeCursorSelection>[0],
          ) => {
            const disposable = target.onDidChangeCursorSelection(listener);
            disposables.push(disposable);
            return disposable;
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });

    // Связываем Y.Text с Monaco ITextModel и awareness (T021)
    const binding = new MonacoBinding(
      yText,
      model,
      new Set([editorProxy]),
      awareness ?? undefined,
    );

    // UndoManager с trackedOrigins: добавляем binding
    if (externalUndoManager) {
      externalUndoManager.trackedOrigins.add(binding);
    }
    const currentUndoManager =
      externalUndoManager ??
      new Y.UndoManager(yText, {
        trackedOrigins: new Set([binding]),
      });

    onUndoManagerInit?.(currentUndoManager);

    const KeyMod = monacoRef.current?.KeyMod ?? { CtrlCmd: 2048, Shift: 1024 };
    const KeyCode = monacoRef.current?.KeyCode ?? { KeyZ: 56, KeyY: 55 };

    // Перехватываем стандартный Undo Monaco и перенаправляем на Yjs UndoManager
    const undoAction = editorInstance.addAction({
      id: "yjs-undo",
      label: "Undo",
      keybindings: [KeyMod.CtrlCmd | KeyCode.KeyZ],
      run: () => {
        currentUndoManager.undo();
      },
    });

    // Перехватываем стандартный Redo Monaco и перенаправляем на Yjs UndoManager
    const redoAction = editorInstance.addAction({
      id: "yjs-redo",
      label: "Redo",
      keybindings: [
        KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ,
        KeyMod.CtrlCmd | KeyCode.KeyY,
      ],
      run: () => {
        currentUndoManager.redo();
      },
    });

    return () => {
      disposables.forEach((d) => {
        d.dispose();
      });
      undoAction.dispose();
      redoAction.dispose();
      binding.destroy();
      if (externalUndoManager) {
        externalUndoManager.trackedOrigins.delete(binding);
      } else {
        currentUndoManager.destroy();
      }
      // Очистка старых курсоров и выделений из Monaco Editor при смене задачи (T031)
      if (editorInstance && !editorInstance.getModel()?.isDisposed()) {
        const currentModel = editorInstance.getModel();
        if (currentModel) {
          const oldDecorations = currentModel
            .getAllDecorations()
            .filter((d) => d.options.className?.includes("yRemoteSelection"))
            .map((d) => d.id);
          if (oldDecorations.length > 0) {
            editorInstance.deltaDecorations(oldDecorations, []);
          }
        }
      }
    };
  }, [
    editorInstance,
    yText,
    awareness,
    externalUndoManager,
    onUndoManagerInit,
  ]);

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
      {isMonacoReady ? (
        <Editor
          height="100%"
          language={language}
          theme={theme}
          value={yText ? undefined : value}
          onChange={(val) => onChange?.(val ?? "")}
          beforeMount={handleBeforeMount}
          onMount={handleEditorDidMount}
          loading={<div className="size-full animate-pulse bg-muted/20" />}
          options={mergedOptions}
        />
      ) : (
        <div className="size-full animate-pulse bg-muted/20" />
      )}
    </div>
  );
};
