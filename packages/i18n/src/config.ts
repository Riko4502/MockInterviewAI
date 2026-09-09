export const locales = ["ru", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ru";

export const localeLabels: Record<Locale, string> = {
  ru: "Русский",
  en: "English",
};

export const langConfig: Record<
  Locale,
  { switchUrl: string; switchLabel: string; homeUrl: string }
> = {
  ru: {
    homeUrl: "/",
    switchUrl: "/en",
    switchLabel: localeLabels.ru,
  },
  en: {
    homeUrl: "/en",
    switchUrl: "/",
    switchLabel: localeLabels.en,
  },
};
