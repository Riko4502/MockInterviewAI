import { messages } from "@packages/i18n";
import type { Metadata } from "next";
import { envConfig } from "@/shared/config/env";
import { LandingPage } from "@/views/landing";

const baseUrl = envConfig.siteUrl;

export const metadata: Metadata = {
  title: messages.ru.landing.site.title,
  description: messages.ru.landing.site.description,
  alternates: {
    canonical: `${baseUrl}/`,
    languages: {
      ru: `${baseUrl}/`,
      en: `${baseUrl}/en/`,
    },
  },
  openGraph: {
    title: messages.ru.landing.site.title,
    description: messages.ru.landing.site.description,
    url: `${baseUrl}/`,
    siteName: "DEVSYNC",
    locale: "ru_RU",
    type: "website",
  },
};

export default function HomePage() {
  return <LandingPage locale="ru" />;
}
