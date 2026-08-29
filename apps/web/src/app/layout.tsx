import type { Metadata } from "next";
import { QueryProvider } from "@/shared/api/client";
import "./globals.css";
import "@packages/ui/globals.css";

export const metadata: Metadata = {
  title: "Mock Interview AI",
  description: "AI-powered technical interview platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
