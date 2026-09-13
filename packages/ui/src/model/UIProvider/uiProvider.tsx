"use client";

import { DialogProvider } from "@model/DialogProvider";
import { DrawerProvider } from "@model/DrawerProvider";
import { ToastProvider } from "@model/ToastProvider";
import type { PropsWithChildren } from "react";

/**
 * Единый UI-провайдер библиотеки `@packages/ui`.
 *
 * Объединяет провайдеры контекстов:
 * - `DialogProvider` (хук `useDialog`)
 * - `DrawerProvider` (хук `useDrawer`)
 * - `ToastProvider` (хук `useToast` и встроенный `Toast.Viewport`)
 *
 * @example
 * ```tsx
 * // apps/web/src/app/providers.tsx или RootLayout
 * import { UIProvider } from "@packages/ui";
 *
 * export function Providers({ children }: { children: React.ReactNode }) {
 *   return <UIProvider>{children}</UIProvider>;
 * }
 * ```
 */
export function UIProvider({ children }: PropsWithChildren) {
  return (
    <DialogProvider>
      <DrawerProvider>
        <ToastProvider>{children}</ToastProvider>
      </DrawerProvider>
    </DialogProvider>
  );
}
