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
  return (
    <html lang={lang} suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased selection:bg-primary selection:text-primary-foreground min-h-screen flex flex-col justify-between">
        <LandingProviders>{children}</LandingProviders>
      </body>
    </html>
  );
}
