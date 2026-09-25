/**
 * Список допустимых тем оформления.
 */
export const THEMES = ["dark", "light"] as const;

/**
 * Допустимые темы оформления приложения и компонентов.
 */
export type Theme = (typeof THEMES)[number];

/**
 * Список допустимых режимов темы оформления профиля пользователя (включая системную).
 */
export const THEME_MODES = ["light", "dark", "system"] as const;

/**
 * Режим темы оформления профиля пользователя.
 */
export type ThemeMode = (typeof THEME_MODES)[number];
