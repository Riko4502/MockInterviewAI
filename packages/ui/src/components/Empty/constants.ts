import { cva } from "class-variance-authority";

/**
 * Варианты оформления корневого контейнера компонента Empty.
 */
export const emptyVariants = cva(
  "flex w-full flex-col items-center justify-center text-center select-none transition-colors",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline: "rounded-xl border border-border bg-transparent",
        card: "rounded-xl border border-border bg-card text-card-foreground shadow-xs",
        dashed: "rounded-xl border border-dashed border-border/80 bg-muted/20",
      },
      size: {
        sm: "p-4 gap-2",
        default: "p-8 gap-3",
        lg: "p-12 gap-4",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

/**
 * Стили для подкомпонентов Empty (Media, Title, Description, Action, Content).
 */
export const EMPTY_STYLES = {
  media:
    "flex items-center justify-center rounded-full bg-muted/50 text-muted-foreground p-3 mb-1 [&_svg]:size-8",
  mediaSm: "p-2 mb-0.5 [&_svg]:size-6",
  mediaLg: "p-4 mb-2 [&_svg]:size-12",
  title: "text-base font-semibold text-foreground tracking-tight",
  titleSm: "text-sm font-medium",
  titleLg: "text-lg font-semibold",
  description: "text-sm text-muted-foreground max-w-sm leading-relaxed",
  descriptionSm: "text-xs max-w-xs",
  descriptionLg: "text-base max-w-md",
  action: "flex items-center gap-2 mt-2",
  content: "w-full mt-2",
} as const;
