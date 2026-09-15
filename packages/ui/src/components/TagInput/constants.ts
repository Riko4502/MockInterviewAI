import { cva } from "@packages/utils";

export const tagInputContainerVariants = cva(
  "flex w-full flex-wrap items-center gap-1.5 rounded-md border border-input bg-card text-foreground shadow-xs transition-colors focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 data-[invalid=true]:border-destructive data-[invalid=true]:ring-destructive/20",
  {
    variants: {
      size: {
        sm: "min-h-8 px-2 py-1 text-xs",
        md: "min-h-10 px-3 py-1.5 text-sm",
        lg: "min-h-12 px-4 py-2 text-base",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);

export const tagBadgeVariants = cva(
  "inline-flex items-center gap-1 rounded font-medium transition-colors select-none",
  {
    variants: {
      variant: {
        default: "bg-primary/10 text-primary border border-primary/20",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "bg-transparent border border-border text-foreground",
        tag: "bg-muted text-muted-foreground hover:text-foreground",
      },
      size: {
        sm: "px-1.5 py-0.2 text-[11px]",
        md: "px-2 py-0.5 text-xs",
        lg: "px-2.5 py-1 text-sm",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export const TAG_INPUT_STYLES = {
  tagRemoveButton:
    "rounded-full p-0.5 hover:bg-muted-foreground/20 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-muted-foreground hover:text-foreground transition-colors cursor-pointer",
  input:
    "flex-1 min-w-[100px] border-0 bg-transparent p-0 text-inherit placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed",
  clearButton:
    "ml-auto p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer transition-colors",
  countBadge: "text-[11px] font-mono text-muted-foreground ml-auto select-none",
} as const;
