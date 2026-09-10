/**
 * Список допустимых тем оформления.
 */
export const THEMES = ["dark", "light"] as const;

/**
 * Допустимые темы оформления приложения и компонентов.
 */
export type Theme = (typeof THEMES)[number];
