import type { editor } from "monaco-editor";

/**
 * Дефолтные настройки Monaco Editor для нашего проекта.
 * Используем дефолтный шрифт системы (Ответ на Вопрос 6).
 */
export const DEFAULT_EDITOR_OPTIONS: editor.IStandaloneEditorConstructionOptions =
  {
    minimap: { enabled: false }, // Отключаем миникарту (код обычно не такой большой)
    fontSize: 14,
    wordWrap: "on", // Автоматический перенос строк, чтобы не было горизонтального скролла
    lineNumbersMinChars: 3,
    padding: { top: 16, bottom: 16 }, // Отступы сверху и снизу
    scrollBeyondLastLine: false, // Запрещаем скроллить далеко вниз за пределы кода
    smoothScrolling: true,
    cursorBlinking: "smooth",
    cursorSmoothCaretAnimation: "on",
    formatOnPaste: true,
    automaticLayout: true, // Чтобы понимать когда родитель поменяет размер
  };
