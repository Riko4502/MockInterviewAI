"use client";

import { ThemeProvider } from "@packages/ui";
import type { ReactNode } from "react";

export interface LandingProvidersProps {
  children: ReactNode;
}

export function LandingProviders({ children }: LandingProvidersProps) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      {children}
    </ThemeProvider>
  );
}
