import { SmoothScrollProvider } from "@/shared/providers/SmoothScrollProvider";
import { ThemeProvider } from "@/shared/providers/ThemeProvider";
import "@/shared/styles/globals.css";
import type { ReactNode } from "react";

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
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <SmoothScrollProvider>{children}</SmoothScrollProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
