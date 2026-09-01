import { defaultLocale, locales, messages } from "@packages/i18n";
import i18n, { type Resource } from "i18next";
import { initReactI18next } from "react-i18next";

if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: messages as unknown as Resource,
    lng: defaultLocale,
    fallbackLng: defaultLocale,
    supportedLngs: locales,
    defaultNS: "landing",
    ns: ["landing", "common", "auth", "interview"],
    interpolation: {
      escapeValue: false,
    },
  });
}

export default i18n;
