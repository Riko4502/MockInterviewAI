import { defaultLocale, type Locale, locales } from "@packages/i18n";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { AppProviders } from "./providers/AppProviders";

export const metadata: Metadata = {
  title: "Mock Interview AI",
  description: "AI-powered technical interview platform",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get("locale")?.value;
  const locale: Locale = locales.includes(rawLocale as Locale)
    ? (rawLocale as Locale)
    : defaultLocale;

  const rawTheme = cookieStore.get("theme")?.value;
  const isLight = rawTheme === "light";

  return (
    <html
      lang={locale}
      className={isLight ? "" : "dark"}
      style={{ colorScheme: isLight ? "light" : "dark" }}
      suppressHydrationWarning
    >
      <body>
        <AppProviders initialTheme={rawTheme || "dark"} initialLocale={locale}>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
