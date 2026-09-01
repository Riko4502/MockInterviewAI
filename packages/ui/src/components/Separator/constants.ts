import { cva } from "@packages/utils";

/**
 * Варианты оформления и ориентации разделителя Separator.
 */
export const separatorVariants = cva("shrink-0 select-none", {
  variants: {
    orientation: {
      horizontal: "h-px w-full",
      vertical: "h-full w-px",
    },
    variant: {
      default: "bg-border",
      muted: "bg-muted",
      dashed:
        "bg-transparent border-dashed border-border data-[orientation=horizontal]:border-t data-[orientation=vertical]:border-l",
      dotted:
        "bg-transparent border-dotted border-border data-[orientation=horizontal]:border-t data-[orientation=vertical]:border-l",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
    variant: "default",
  },
});

/**
 * Стили для разделителя с текстовой подписью.
 */
export const SEPARATOR_STYLES = {
  container:
    "relative flex items-center justify-center w-full my-4 select-none",
  label:
    "relative z-10 bg-background px-3 text-xs font-medium uppercase text-muted-foreground tracking-wider",
  line: "absolute inset-0 flex items-center",
} as const;
