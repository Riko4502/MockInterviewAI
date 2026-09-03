import { defaultLocale, type Locale } from "./config";
import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enInterview from "./locales/en/interview.json";
import enLanding from "./locales/en/landing.json";
import ruAuth from "./locales/ru/auth.json";
import ruCommon from "./locales/ru/common.json";
import ruInterview from "./locales/ru/interview.json";
import ruLanding from "./locales/ru/landing.json";
import type { Messages } from "./types";

export * from "./config";
export * from "./types";

export const messages: Record<Locale, Messages> = {
  ru: {
    common: ruCommon,
    auth: ruAuth,
    interview: ruInterview,
    landing: ruLanding,
  },
  en: {
    common: enCommon,
    auth: enAuth,
    interview: enInterview,
    landing: enLanding,
  },
};

export function getMessages(locale: string): Messages {
  if (locale in messages) {
    return messages[locale as Locale];
  }
  return messages[defaultLocale];
}
