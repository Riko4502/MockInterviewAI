import { messages } from "@packages/i18n";
import type { Metadata } from "next";
import { getSiteUrl } from "@/shared/config/env";
import { LandingPage } from "@/views/landing";

const baseUrl = getSiteUrl();

export const metadata: Metadata = {
  title: messages.en.landing.site.title,
  description: messages.en.landing.site.description,
  alternates: {
    canonical: `${baseUrl}/en/`,
    languages: {
      ru: `${baseUrl}/`,
      en: `${baseUrl}/en/`,
    },
  },
  openGraph: {
    title: messages.en.landing.site.title,
    description: messages.en.landing.site.description,
    url: `${baseUrl}/en/`,
    siteName: "DEVSYNC",
    locale: "en_US",
    type: "website",
  },
};

export default function EnglishHomePage() {
  return <LandingPage locale="en" />;
}
