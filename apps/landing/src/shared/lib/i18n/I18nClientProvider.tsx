"use client";

import type { Locale } from "@packages/i18n";
import { type ReactNode, useEffect } from "react";
import { I18nextProvider } from "react-i18next";
import i18n from "../i18n";

export interface I18nClientProviderProps {
  children: ReactNode;
  locale?: Locale;
}

/**
 * Client boundary компонент локализации для apps/landing.
 * Использует официальный I18nextProvider из react-i18next и сохраняет
 * возможность Server Component composition через children.
 */
export function I18nClientProvider({
  children,
  locale,
}: I18nClientProviderProps) {
  useEffect(() => {
    if (locale && i18n.language !== locale) {
      i18n.changeLanguage(locale);
    }
  }, [locale]);

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}

export default I18nClientProvider;
