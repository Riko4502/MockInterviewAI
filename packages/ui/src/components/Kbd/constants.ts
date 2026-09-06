import { cva } from "@packages/utils";

/**
 * Варианты оформления компонента Kbd (обозначение клавиш клавиатуры).
 */
export const kbdVariants = cva(
  "inline-flex items-center justify-center gap-1 rounded border font-mono font-medium select-none",
  {
    variants: {
      variant: {
        default: "border-border bg-muted text-muted-foreground",
        outline: "border-border bg-transparent text-foreground",
      },
      size: {
        default: "h-5 min-w-5 px-1.5 text-xs",
        sm: "h-4 min-w-4 px-1 text-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
