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
    if (window.location.pathname.startsWith("/en")) {
      return "en";
    }
  }
  return defaultLocale;
}

export default function LandingLoading() {
  const locale = getClientLocale();
  const t = getMessages(locale).common.loading;

  return (
    <LoadingScreen
      title={t.landingTitle}
      badgeText={t.badges.system}
      description={t.descriptions.landing}
      steps={t.steps.landing}
      systemActiveText={t.systemActive}
      brandLabel={t.brandLabel}
    />
  );
}
