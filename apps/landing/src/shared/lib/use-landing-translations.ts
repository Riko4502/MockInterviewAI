"use client";

import { getMessages, type Locale } from "@packages/i18n";
import { usePathname } from "next/navigation";

export function useLandingTranslations() {
  const pathname = usePathname();
  const locale: Locale = pathname?.startsWith("/en") ? "en" : "ru";
  const messages = getMessages(locale);

  return {
    landing: messages.landing,
    common: messages.common,
    locale,
  };
}
