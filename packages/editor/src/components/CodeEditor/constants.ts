import type { editor } from "monaco-editor";

/**
 * Дефолтные настройки Monaco Editor для нашего проекта.
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

    // делаем редактор примитивным
    renderValidationDecorations: "off", // Полностью отключаем красные/жёлтые волнистые линии ошибок
    quickSuggestions: false, // Отключаем автоматическое появление окна подсказок при обычном наборе
    suggestOnTriggerCharacters: false, // Отключаем подсказки при вводе триггерных символов (например, точки)
    acceptSuggestionOnEnter: "off", // Клавиша Enter переводит строку, а не принимает подсказку
    tabCompletion: "off", // Клавиша Tab вставляет отступ, а не автодополнение
    wordBasedSuggestions: "off", // Не предлагать слова из открытого документа
    parameterHints: { enabled: false }, // Не показывать всплывающие подсказки параметров функций
    hover: { enabled: false }, // Не показывать всплывающие подсказки типов при наведении мыши
    lightbulb: { enabled: "off" as editor.ShowLightbulbIconMode }, // Не показывать лампочку с подсказками исправлений
    "semanticHighlighting.enabled": true, // Включаем семантическую подсветку вызовов функций (как в VS Code)
    contextmenu: false, // Отключаем контекстное меню Monaco, чтобы открывалось стандартное браузерное меню
  };
