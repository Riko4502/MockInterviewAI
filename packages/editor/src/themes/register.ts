import type { Monaco } from "@monaco-editor/react";
import type { Theme } from "@packages/types";
import type { editor } from "monaco-editor";
import { MOCKINTERVIEW_DARK_THEME } from "./mockinterview-dark";
import { MOCKINTERVIEW_LIGHT_THEME } from "./mockinterview-light";

export { THEMES } from "@packages/types";

const THEME_DEFINITIONS: Record<Theme, editor.IStandaloneThemeData> = {
  dark: MOCKINTERVIEW_DARK_THEME,
  light: MOCKINTERVIEW_LIGHT_THEME,
};

/**
 * Регистрирует кастомные темы в инстансе Monaco Editor.
 *
 * @param monaco - Инстанс Monaco Editor, получаемый из beforeMount или onMount
 */
export function registerThemes(monaco: Monaco): void {
  for (const [name, theme] of Object.entries(THEME_DEFINITIONS)) {
    monaco.editor.defineTheme(name, theme);
  }
}
