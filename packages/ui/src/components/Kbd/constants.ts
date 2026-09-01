import { cva } from "@packages/utils";

/**
 * Варианты оформления компонента Kbd (обозначение клавиш клавиатуры).
 */
export const kbdVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded border border-border bg-muted font-mono font-medium text-muted-foreground select-none",
  {
    variants: {
      size: {
        default: "h-5 min-w-5 px-1.5 text-xs",
        sm: "h-4 min-w-4 px-1 text-[10px]",
      },
    },
    defaultVariants: {
      size: "default",
    },
  },
);
