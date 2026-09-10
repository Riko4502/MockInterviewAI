import type { editor } from "monaco-editor";

export const MOCKINTERVIEW_DARK_THEME: editor.IStandaloneThemeData = {
  base: "vs-dark", // Базовая тёмная тема от VS Code
  inherit: true, // Наследуем абсолютно все цвета и правила из vs-dark
  rules: [], // Пустой список: синтаксис подсвечивается стандартными цветами VS Code
  colors: {}, // Пустой объект: фон (#1e1e1e), курсор, выделение и виджеты — всё стандартное из VS Code
};
