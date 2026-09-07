import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "./providers/AppProviders";

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
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
