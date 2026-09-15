import "@/shared/styles/globals.css";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/shared/providers/ThemeProvider";

export function BaseLayout({
  children,
  lang,
}: {
  children: ReactNode;
  lang: string;
}) {
  return (
    <html lang={lang} className="scroll-smooth" suppressHydrationWarning>
      <body className="bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground min-h-screen flex flex-col justify-between">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
