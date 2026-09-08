"use client";

import {
  createContext,
  type PropsWithChildren,
  useCallback,
  useContext,
  useState,
} from "react";

interface DialogEntry {
  id: string;
  payload?: unknown;
}

interface DialogContextValue {
  stack: DialogEntry[];
  open: (id: string, payload?: unknown) => void;
  close: (id: string) => void;
}

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: PropsWithChildren) {
  const [stack, setStack] = useState<DialogEntry[]>([]);

  const open = useCallback((id: string, payload?: unknown) => {
    setStack((prev) => [...prev, { id, payload }]);
  }, []);

  const close = useCallback((id: string) => {
    setStack((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  return (
    <DialogContext.Provider value={{ stack, open, close }}>
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
