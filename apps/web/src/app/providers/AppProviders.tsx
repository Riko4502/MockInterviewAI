"use client";

import { UIProvider } from "@packages/ui";
import type { PropsWithChildren } from "react";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { SessionProvider } from "@/entities/session";
import { NotificationRealtime } from "@/features/notification-realtime";
import { UserPreferencesSync } from "@/features/update-profile";
import { QueryProvider } from "./QueryProvider";

export interface AppProvidersProps extends PropsWithChildren {
  initialTheme?: string;
  initialLocale?: string;
}

export function AppProviders({
  children,
  initialTheme,
  initialLocale,
}: AppProvidersProps) {
  const { i18n } = useTranslation();

  useEffect(() => {
    if (initialLocale && i18n.language !== initialLocale) {
      void i18n.changeLanguage(initialLocale);
    }
  }, [initialLocale, i18n]);

  return (
    <QueryProvider>
      <SessionProvider>
        <UIProvider defaultTheme={initialTheme}>
          <UserPreferencesSync />
          <NotificationRealtime />
          {children}
        </UIProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
