import { defaultLocale, type Locale } from "./config";
import enAuth from "./locales/en/auth.json";
import enCommon from "./locales/en/common.json";
import enDashboard from "./locales/en/dashboard.json";
import enInterview from "./locales/en/interview.json";
import enLanding from "./locales/en/landing.json";
import enShowcase from "./locales/en/showcase.json";
import enTelegram from "./locales/en/telegram.json";
import ruAuth from "./locales/ru/auth.json";
import ruCommon from "./locales/ru/common.json";
import ruDashboard from "./locales/ru/dashboard.json";
import ruInterview from "./locales/ru/interview.json";
import ruLanding from "./locales/ru/landing.json";
import ruShowcase from "./locales/ru/showcase.json";
import ruTelegram from "./locales/ru/telegram.json";
import type { Messages } from "./types";

export * from "./config";
export * from "./types";

export const messages: Record<Locale, Messages> = {
  ru: {
    common: ruCommon,
    dashboard: ruDashboard,
    auth: ruAuth,
    interview: ruInterview,
    landing: ruLanding,
    telegram: ruTelegram,
    showcase: ruShowcase,
  },
  en: {
    common: enCommon,
    dashboard: enDashboard,
    auth: enAuth,
    interview: enInterview,
    landing: enLanding,
    telegram: enTelegram,
    showcase: enShowcase,
  },
};

export function getMessages(locale: string): Messages {
  if (locale in messages) {
    return messages[locale as Locale];
  }
  return messages[defaultLocale];
}
