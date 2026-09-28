import {
  defaultLocale,
  getMessages,
  type Locale,
  locales,
} from "@packages/i18n";
import "@/shared/styles/globals.css";
import type { ReactNode } from "react";
import { LandingProviders } from "./LandingProviders";

export function BaseLayout({
  children,
  lang,
}: {
  children: ReactNode;
  lang: string;
}) {
  const validLocale: Locale = locales.includes(lang as Locale)
    ? (lang as Locale)
    : defaultLocale;
  const t = getMessages(validLocale).common.loading;

  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground min-h-screen flex flex-col justify-between">
        <LandingProviders
          title={t.landingTitle}
          badgeText={t.badges.system}
          description={t.descriptions.landing}
          steps={t.steps.landing}
          systemActiveText={t.systemActive}
          brandLabel={t.brandLabel}
        >
          {children}
        </LandingProviders>
      </body>
    </html>
  );
}
