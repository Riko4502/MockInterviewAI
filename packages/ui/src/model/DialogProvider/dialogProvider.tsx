"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from "react";
import type { DialogContextValue, DialogEntry } from "./types";

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: PropsWithChildren) {
  const [stack, setStack] = useState<DialogEntry[]>([]);

  const open = useCallback((name: string, payload?: unknown) => {
    setStack((prev) => [...prev, { name, payload }]);
  }, []);

  const close = useCallback((name: string) => {
    setStack((prev) => prev.filter((entry) => entry.name !== name));
  }, []);

  const allClose = useCallback(() => {
    setStack([]);
  }, []);

  return (
    <DialogContext.Provider value={{ stack, open, close, allClose }}>
      {children}
    </DialogContext.Provider>
  );
}

export function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error(
      "useDialogContext должен использоваться внутри DialogProvider",
    );
  }
  return ctx;
}
