"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from "react";
import type { DrawerController, DrawerEntry } from "./types";

const DrawerContext = createContext<DrawerController | null>(null);

/**
 * Провайдер контекста для программного управления шторками (Drawer).
 */
export function DrawerProvider({ children }: PropsWithChildren) {
  const [stack, setStack] = useState<DrawerEntry[]>([]);

  const open = useCallback(function open<T>(name: string, payload?: T) {
    setStack((prev) => [
      ...prev.filter((entry) => entry.name !== name),
      { name, payload },
    ]);
  }, []);

  const close = useCallback((name: string) => {
    setStack((prev) => prev.filter((entry) => entry.name !== name));
  }, []);

  const allClose = useCallback(() => {
    setStack([]);
  }, []);

  const get = useCallback(
    function get<T>(name: string): T | undefined {
      return stack.find((entry) => entry.name === name)?.payload as
        | T
        | undefined;
    },
    [stack],
  );

  const isOpen = useCallback(
    (name: string) => stack.some((entry) => entry.name === name),
    [stack],
  );

  return (
    <DrawerContext.Provider value={{ open, close, allClose, get, isOpen }}>
      {children}
    </DrawerContext.Provider>
  );
}

/**
 * Хук для программного управления шторками (Drawer) через единый стек.
 *
 * @example
 * ```tsx
 * const drawer = useDrawer<{ id: string }>();
 * drawer.open("user-profile", { id: "123" });
 * drawer.isOpen("user-profile"); // boolean
 * drawer.get("user-profile"); // { id: "123" }
 * drawer.close("user-profile");
 * drawer.allClose();
 * ```
 */
export function useDrawer<TPayload = unknown>(): DrawerController<TPayload> {
  const ctx = useContext(DrawerContext);
  if (!ctx) {
    throw new Error(
      "useDrawer должен использоваться внутри DrawerProvider или UIProvider",
    );
  }
  return ctx as unknown as DrawerController<TPayload>;
}
