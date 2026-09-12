"use client";

import { composeProviders, UIProvider } from "@packages/ui";
import type { PropsWithChildren } from "react";
import { SessionProvider } from "@/entities/session";
import { QueryProvider } from "./QueryProvider";

const Providers = composeProviders(QueryProvider, SessionProvider, UIProvider);

export function AppProviders({ children }: PropsWithChildren) {
  return <Providers>{children}</Providers>;
}
