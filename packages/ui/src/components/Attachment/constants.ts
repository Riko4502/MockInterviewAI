import { cva } from "@packages/utils";

export const attachmentVariants = cva(
  "group relative flex items-center gap-2.5 overflow-hidden rounded-xl border transition-all select-none",
  {
    variants: {
      variant: {
        default:
          "p-2.5 bg-card/90 border-border text-foreground hover:bg-card hover:border-primary/40 shadow-xs",
        compact:
          "px-2.5 py-1.5 bg-muted/60 border-border/70 text-foreground hover:bg-muted text-xs",
        card: "flex-col items-start p-3 bg-card border-border text-foreground hover:border-primary/40 shadow-sm w-48",
      },
      status: {
        default: "",
        uploading: "border-primary/40 bg-primary/5",
        error: "border-destructive/50 bg-destructive/5 text-destructive",
        success: "border-success/40 bg-success/5",
      },
    },
    defaultVariants: {
      variant: "default",
      status: "default",
    },
  },
);

export const ATTACHMENT_STYLES = {
  preview:
    "relative flex shrink-0 items-center justify-center rounded-lg bg-muted/80 text-muted-foreground overflow-hidden",
  previewSizes: {
    default: "size-10",
    compact: "size-6",
    card: "w-full h-24 mb-2 rounded-lg",
  },
  info: "flex flex-1 flex-col min-w-0 gap-0.5",
  name: "text-xs font-medium truncate text-foreground",
  size: "text-[10px] text-muted-foreground font-mono",
  remove:
    "shrink-0 rounded-md p-1 text-muted-foreground/70 opacity-70 transition-opacity hover:opacity-100 hover:text-foreground hover:bg-muted focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer",
  progress: "absolute bottom-0 inset-x-0 h-1 bg-muted overflow-hidden",
  progressBar: "h-full bg-primary transition-all duration-300",
  list: "flex flex-wrap items-center gap-2",
  trigger:
    "inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-foreground cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring",
} as const;
