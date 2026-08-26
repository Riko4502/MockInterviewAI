/**
 * Централизованная конфигурация ссылок авторизации и веб-приложения.
 * Поддерживает запуск приложения на поддомене (например, app.devsync.ai или app.mockinterviewai.com)
 * через переменную окружения PUBLIC_APP_URL с безопасным дефолтом.
 */

const DEFAULT_APP_URL =
  (typeof import.meta !== "undefined" &&
    (import.meta as unknown as { env?: Record<string, string> }).env
      ?.PUBLIC_APP_URL) ||
  (typeof process !== "undefined" && process.env?.PUBLIC_APP_URL) ||
  "https://app.mockinterviewai.com";

export const navigationConfig = {
  // Базовый URL основного приложения
  appBaseUrl: DEFAULT_APP_URL,

  // GitHub репозиторий
  githubUrl: "https://github.com/Riko4502/MockInterviewAI",

  // Пути авторизации и разделов приложения
  paths: {
    login: "/login",
    register: "/register",
    dashboard: "/dashboard",
    tracks: "/tracks",
    docs: "/docs",
    guides: "/guides",
    systemDesign: "/system-design",
  },
} as const;

/**
 * Получить URL страницы входа (Login)
 * @param customBaseUrl Опциональный кастомный URL (для тестов или окружений)
 */
export function getAuthUrl(customBaseUrl?: string): string {
  const base = (customBaseUrl || navigationConfig.appBaseUrl).replace(
    /\/+$/,
    "",
  );
  return `${base}${navigationConfig.paths.login}`;
}

/**
 * Получить URL страницы регистрации (Register / Get Started)
 * @param customBaseUrl Опциональный кастомный URL (для тестов или окружений)
 */
export function getRegisterUrl(customBaseUrl?: string): string {
  const base = (customBaseUrl || navigationConfig.appBaseUrl).replace(
    /\/+$/,
    "",
  );
  return `${base}${navigationConfig.paths.register}`;
}

/**
 * Сформировать полный URL для любого внутреннего пути приложения
 * @param path Путь внутри приложения (например, '/dashboard')
 * @param customBaseUrl Опциональный кастомный базовый URL
 */
export function getAppUrl(path: string, customBaseUrl?: string): string {
  const base = (customBaseUrl || navigationConfig.appBaseUrl).replace(
    /\/+$/,
    "",
  );
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}
