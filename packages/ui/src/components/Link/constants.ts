import { cva } from "@packages/utils";

/**
 * Варианты стилизации компонента ссылки (Link).
 */
export const linkVariants = cva(
  "inline-flex items-center gap-1 font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xs select-none disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "text-primary hover:text-primary/80",
        muted: "text-muted-foreground hover:text-foreground",
        destructive: "text-destructive hover:text-destructive/80",
        subtle: "text-foreground hover:text-primary",
      },
      underline: {
        always: "underline underline-offset-4",
        hover: "no-underline hover:underline underline-offset-4",
        none: "no-underline",
      },
      size: {
        sm: "text-xs",
        default: "text-sm",
        lg: "text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      underline: "hover",
      size: "default",
    },
  },
);
