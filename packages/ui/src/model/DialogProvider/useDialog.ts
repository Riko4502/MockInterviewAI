import { useDialogContext } from "./dialogProvider";
import type { DialogController, DialogState } from "./types";

/** Без name —  по месту вызова. */
export function useDialog(): DialogController;

/** С name — состояние конкретного диалога. */
export function useDialog<T = unknown>(name: string): DialogState<T>;

export function useDialog<T = unknown>(name?: string) {
  const { stack, open, close, allClose } = useDialogContext();

  if (name === undefined) {
    return { open, close, allClose };
  }

  const entry = stack.find((e) => e.name === name);
  const isTop = stack[stack.length - 1]?.name === name;

  return {
    isOpen: !!entry,
    isTop,
    payload: entry?.payload as T | undefined,
    open: (data?: T) => open(name, data),
    close: () => close(name),
    allClose,
  };
}
