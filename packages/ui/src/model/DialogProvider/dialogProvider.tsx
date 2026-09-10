"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from "react";
import type { DialogController, DialogEntry, DialogName } from "./types";

const DialogContext = createContext<DialogController | null>(null);

export function DialogProvider({ children }: PropsWithChildren) {
  const [stack, setStack] = useState<DialogEntry[]>([]);

  const open = useCallback(function open<T>(name: DialogName, payload?: T) {
    setStack((prev) => [...prev, { name, payload }]);
  }, []);

  const close = useCallback((name: DialogName) => {
    setStack((prev) => prev.filter((entry) => entry.name !== name));
  }, []);

  const allClose = useCallback(() => {
    setStack([]);
  }, []);

  const get = useCallback(
    function get<T>(name: DialogName): T | undefined {
      return stack.find((entry) => entry.name === name)?.payload as
        | T
        | undefined;
    },
    [stack],
  );

  const isOpen = useCallback(
    (name: DialogName) => stack.some((entry) => entry.name === name),
    [stack],
  );

  return (
    <DialogContext.Provider value={{ open, close, allClose, get, isOpen }}>
      {children}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogController {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog должен использоваться внутри DialogProvider");
  }
  return ctx;
}
