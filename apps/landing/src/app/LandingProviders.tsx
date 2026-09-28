"use client";

import { AppPreloader, ThemeProvider } from "@packages/ui";
import type { ReactNode } from "react";

export interface LandingProvidersProps {
  children: ReactNode;
  title: string;
  badgeText: string;
  description: string;
  steps: string[];
  systemActiveText: string;
  brandLabel: string;
}

export function LandingProviders({
  children,
  title,
  badgeText,
  description,
  steps,
  systemActiveText,
  brandLabel,
}: LandingProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AppPreloader
        minDuration={2200}
        fadeDuration={1500}
        title={title}
        badgeText={badgeText}
        description={description}
        steps={steps}
        systemActiveText={systemActiveText}
        brandLabel={brandLabel}
      >
        {children}
      </AppPreloader>
    </ThemeProvider>
  );
}
