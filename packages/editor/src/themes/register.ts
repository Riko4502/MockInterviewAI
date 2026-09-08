import type { Monaco } from "@monaco-editor/react";
import { MOCKINTERVIEW_DARK_THEME } from "./mockinterview-dark";
import { MOCKINTERVIEW_LIGHT_THEME } from "./mockinterview-light";

/**
 * Уникальные идентификаторы кастомных тем для Monaco Editor.
 */
export const MOCKINTERVIEW_DARK_THEME_ID = "mockinterview-dark";
export const MOCKINTERVIEW_LIGHT_THEME_ID = "mockinterview-light";

/**
 * Регистрирует кастомные темы в инстансе Monaco Editor.
 *
 * @param monaco - Инстанс Monaco Editor, получаемый из beforeMount или onMount
 */
export function registerThemes(monaco: Monaco) {
  monaco.editor.defineTheme(
    MOCKINTERVIEW_DARK_THEME_ID,
    MOCKINTERVIEW_DARK_THEME,
  );
  monaco.editor.defineTheme(
    MOCKINTERVIEW_LIGHT_THEME_ID,
    MOCKINTERVIEW_LIGHT_THEME,
  );
}
