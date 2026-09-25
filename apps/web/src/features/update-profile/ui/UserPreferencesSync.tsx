"use client";

import { useTheme } from "@packages/ui";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { useCurrentUser } from "@/entities/user";
import "@/shared/lib/i18n";

/**
 * Глобальный компонент синхронизации предпочтений пользователя (тема и язык).
 *
 * Отслеживает загрузку профиля текущего пользователя и применяет его сохраненные
 * настройки темы и языка во всем приложении, независимо от того, на какой странице
 * находится пользователь. Также выставляет cookies для минимизации SSR-flicker.
 */
export function UserPreferencesSync() {
  const { isAuthenticated } = useSession();
  const { data: user } = useCurrentUser();
  const { setTheme } = useTheme();
  const { i18n } = useTranslation();

  const lastSyncedThemeRef = useRef<string | null>(null);
  const lastSyncedLocaleRef = useRef<string | null>(null);

  const userTheme = user?.theme;
  const userLocale = user?.locale;

  useEffect(() => {
    if (!isAuthenticated) {
      lastSyncedThemeRef.current = null;
      lastSyncedLocaleRef.current = null;
      return;
    }

    if (userTheme && userTheme !== lastSyncedThemeRef.current) {
      lastSyncedThemeRef.current = userTheme;
      setTheme(userTheme);
      if (typeof document !== "undefined") {
        // biome-ignore lint/suspicious/noDocumentCookie: persist theme cookie for SSR
        document.cookie = `theme=${encodeURIComponent(userTheme)}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }

    if (userLocale && userLocale !== lastSyncedLocaleRef.current) {
      lastSyncedLocaleRef.current = userLocale;
      void i18n.changeLanguage(userLocale);
      if (typeof document !== "undefined") {
        // biome-ignore lint/suspicious/noDocumentCookie: persist locale cookie for SSR
        document.cookie = `locale=${encodeURIComponent(userLocale)}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }
  }, [isAuthenticated, userTheme, userLocale, setTheme, i18n]);

  return null;
}
