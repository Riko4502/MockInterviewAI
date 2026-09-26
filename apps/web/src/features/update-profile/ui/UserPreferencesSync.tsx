"use client";

import { useTheme } from "@packages/ui";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";
import { setPreferenceCookies, useCurrentUser } from "@/entities/user";
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
  const { data: user } = useCurrentUser({ enabled: isAuthenticated });
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
      setPreferenceCookies({ theme: userTheme });
    }

    if (userLocale && userLocale !== lastSyncedLocaleRef.current) {
      lastSyncedLocaleRef.current = userLocale;
      void i18n.changeLanguage(userLocale);
      setPreferenceCookies({ locale: userLocale });
      if (typeof document !== "undefined") {
        document.documentElement.lang = userLocale;
      }
    }
  }, [isAuthenticated, userTheme, userLocale, setTheme, i18n]);

  return null;
}
