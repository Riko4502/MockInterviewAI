import { useDialogContext } from "../../DialogProvider";

export function useDialog<T = unknown>(id: string) {
  const { stack, open, close } = useDialogContext();

  const entry = stack.find((e) => e.id === id);
  const isTop = stack[stack.length - 1]?.id === id;

  return {
    isOpen: !!entry,
    isTop,
    payload: entry?.payload as T | undefined,
    open: (data?: T) => open(id, data),
    close: () => close(id),
  };
}
