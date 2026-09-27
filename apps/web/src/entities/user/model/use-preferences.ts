"use client";

import {
  getProfileControllerGetMyProfileQueryKey,
  type UserProfileDto,
  useProfileControllerUpdateMyProfile,
} from "@packages/api";
import { defaultLocale, type Locale, locales } from "@packages/i18n";
import type { Theme, ThemeMode } from "@packages/types";
import { useTheme } from "@packages/ui";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useSession } from "@/entities/session";

export function setPreferenceCookies(preferences: {
  theme?: string;
  locale?: string;
}) {
  if (typeof document === "undefined") return;

  if (preferences.theme) {
    // biome-ignore lint/suspicious/noDocumentCookie: persist theme cookie for SSR
    document.cookie = `theme=${encodeURIComponent(preferences.theme)}; path=/; max-age=31536000; SameSite=Lax`;
  }
  if (preferences.locale) {
    // biome-ignore lint/suspicious/noDocumentCookie: persist locale cookie for SSR
    document.cookie = `locale=${encodeURIComponent(preferences.locale)}; path=/; max-age=31536000; SameSite=Lax`;
  }
}

export function usePreferences() {
  const session = useSession({ optional: true });
  const isAuthenticated = session?.isAuthenticated ?? false;
  const { setTheme: setAppTheme, theme, resolvedTheme } = useTheme();
  const { i18n } = useTranslation();
  const queryClient = useQueryClient();
  const updateProfileMutation = useProfileControllerUpdateMyProfile({
    mutation: {
      onSuccess: (updated) => {
        queryClient.setQueryData(
          getProfileControllerGetMyProfileQueryKey(),
          updated,
        );
        if (updated.theme) {
          setPreferenceCookies({ theme: updated.theme });
        }
        if (updated.locale) {
          setPreferenceCookies({ locale: updated.locale });
        }
      },
    },
  });

  const changeTheme = useCallback(
    (newTheme: ThemeMode) => {
      setAppTheme(newTheme);
      setPreferenceCookies({ theme: newTheme });
      if (isAuthenticated) {
        queryClient.setQueryData(
          getProfileControllerGetMyProfileQueryKey(),
          (old: UserProfileDto | undefined) =>
            old ? { ...old, theme: newTheme } : old,
        );
        updateProfileMutation.mutate({ data: { theme: newTheme } });
      }
    },
    [setAppTheme, isAuthenticated, queryClient, updateProfileMutation],
  );

  const changeLocale = useCallback(
    (newLocale: Locale) => {
      void i18n.changeLanguage(newLocale);
      setPreferenceCookies({ locale: newLocale });
      if (typeof document !== "undefined") {
        document.documentElement.lang = newLocale;
      }
      if (isAuthenticated) {
        queryClient.setQueryData(
          getProfileControllerGetMyProfileQueryKey(),
          (old: UserProfileDto | undefined) =>
            old ? { ...old, locale: newLocale } : old,
        );
        updateProfileMutation.mutate({ data: { locale: newLocale } });
      }
    },
    [i18n, isAuthenticated, queryClient, updateProfileMutation],
  );

  const toggleTheme = useCallback(() => {
    const isCurrentlyDark =
      theme === "dark" ||
      (theme === "system" && resolvedTheme === "dark") ||
      (!theme && resolvedTheme === "dark");
    const nextTheme: ThemeMode = isCurrentlyDark ? "light" : "dark";
    changeTheme(nextTheme);
  }, [theme, resolvedTheme, changeTheme]);

  const currentLocale = locales.includes(i18n.language as Locale)
    ? (i18n.language as Locale)
    : defaultLocale;

  return {
    theme: theme as ThemeMode | undefined,
    resolvedTheme: resolvedTheme as Theme | undefined,
    locale: currentLocale,
    changeTheme,
    changeLocale,
    toggleTheme,
  };
}
