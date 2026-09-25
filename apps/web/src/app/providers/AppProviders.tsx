"use client";

import { composeProviders, UIProvider } from "@packages/ui";
import type { PropsWithChildren } from "react";
import { SessionProvider } from "@/entities/session";
import { NotificationRealtime } from "@/features/notification-realtime";
import { UserPreferencesSync } from "@/features/update-profile";
import { QueryProvider } from "./QueryProvider";

const Providers = composeProviders(QueryProvider, SessionProvider, UIProvider);

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <Providers>
      <UserPreferencesSync />
      <NotificationRealtime />
      {children}
    </Providers>
  );
}
