"use client";

import {
  defaultLocale,
  getMessages,
  type Locale,
  locales,
} from "@packages/i18n";
import { LoadingScreen } from "@packages/ui";

function getClientLocale(): Locale {
  if (typeof document !== "undefined") {
    const match = document.cookie.match(/(?:^|;\s*)locale=([^;]*)/);
    if (match) {
      const cookieLocale = decodeURIComponent(match[1]) as Locale;
      if (locales.includes(cookieLocale)) {
        return cookieLocale;
      }
    }
  }
  return defaultLocale;
}

export default function Loading() {
  const locale = getClientLocale();
  const t = getMessages(locale).common.loading;

  return (
    <LoadingScreen
      title={t.title}
      badgeText={t.badges.system}
      description={t.descriptions.default}
      steps={t.steps.root}
      systemActiveText={t.systemActive}
      brandLabel={t.brandLabel}
    />
  );
}
