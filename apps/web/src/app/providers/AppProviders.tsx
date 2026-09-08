"use client";

import type { PropsWithChildren } from "react";
import { SessionProvider } from "@/entities/session";
import { DialogProvider } from "./DialogProvider";
import { QueryProvider } from "./QueryProvider";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryProvider>
      <SessionProvider>
        <DialogProvider>{children}</DialogProvider>
      </SessionProvider>
    </QueryProvider>
  );
}
