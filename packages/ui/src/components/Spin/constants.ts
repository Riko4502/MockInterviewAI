import { cva } from "@packages/utils";

/**
 * Варианты стилей анимации и размеров индикатора загрузки.
 */
export const spinVariants = cva("animate-spin text-current", {
  variants: {
    variant: {
      default: "text-primary",
      secondary: "text-secondary-foreground",
      muted: "text-muted-foreground",
      success: "text-success",
      destructive: "text-destructive",
      white: "text-white",
      current: "text-current",
    },
    size: {
      xs: "size-3.5",
      sm: "size-4",
      default: "size-5",
      md: "size-5",
      lg: "size-8",
      xl: "size-12",
    },
  },
  defaultVariants: {
    variant: "default",
    size: "default",
  },
});

/**
 * Стили контейнера, оверлея и подписей для компонента Spin.
 */
export const SPIN_STYLES = {
  wrapper: "relative inline-block w-full",
  overlay:
    "absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-[1px] transition-all rounded-[inherit]",
  fullscreen:
    "fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm",
  content: "transition-opacity duration-200",
  contentBlurred: "opacity-40 pointer-events-none select-none",
  tip: "text-xs font-medium text-muted-foreground select-none",
} as const;
