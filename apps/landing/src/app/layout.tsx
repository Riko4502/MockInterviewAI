import "@/shared/styles/globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "DEVSYNC | Платформа технических собеседований с ИИ-подсказками",
  description:
    "Проводите технические мок-интервью с реальными разработчиками. Совместный лайвкодинг в реальном времени, видеосвязь и наводящие подсказки от ИИ.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-background text-foreground font-sans antialiased selection:bg-primary selection:text-primary-foreground min-h-screen flex flex-col justify-between">
        {children}
      </body>
    </html>
  );
}
