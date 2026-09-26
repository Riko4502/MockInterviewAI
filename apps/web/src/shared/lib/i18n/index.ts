import { defaultLocale, type Locale, locales, messages } from "@packages/i18n";
import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

function getInitialLocale(): Locale {
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

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: messages as unknown as Resource,
    lng: getInitialLocale(),
    fallbackLng: defaultLocale,
    supportedLngs: locales,
    defaultNS: "common",
    ns: ["common", "auth", "interview"],
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
