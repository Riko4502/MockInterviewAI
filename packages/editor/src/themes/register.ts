import type { Monaco } from "@monaco-editor/react";
import { MOCKINTERVIEW_DARK_THEME } from "./mockinterview-dark";
import { MOCKINTERVIEW_LIGHT_THEME } from "./mockinterview-light";

/**
 * Идентификаторы тем оформления Monaco Editor.
 */
export const THEMES = ["dark", "light"] as const;

/**
 * Регистрирует кастомные темы в инстансе Monaco Editor.
 *
 * @param monaco - Инстанс Monaco Editor, получаемый из beforeMount или onMount
 */
export function registerThemes(monaco: Monaco) {
  monaco.editor.defineTheme("dark", MOCKINTERVIEW_DARK_THEME);
  monaco.editor.defineTheme("light", MOCKINTERVIEW_LIGHT_THEME);
}
