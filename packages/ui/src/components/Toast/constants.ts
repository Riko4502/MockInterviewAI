import { cva } from "@packages/utils";

export const toastVariants = cva(
  "group pointer-events-auto flex w-full items-start justify-between space-x-3 overflow-hidden rounded-xl border p-4 shadow-xl select-none data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
  {
    variants: {
      status: {
        default: "border-border bg-card text-foreground",
        success:
          "border-success/30 bg-card text-foreground dark:border-success/30",
        destructive:
          "border-destructive/40 bg-card text-foreground dark:border-destructive/40",
        error:
          "border-destructive/40 bg-card text-foreground dark:border-destructive/40",
        warning:
          "border-amber-500/30 bg-card text-foreground dark:border-amber-400/30",
        info: "border-chart-4/30 bg-card text-foreground dark:border-chart-4/30",
      },
    },
    defaultVariants: {
      status: "default",
    },
  },
);

export const TOAST_STYLES = {
  viewport:
    "fixed bottom-0 right-0 z-[100] flex max-h-screen w-full flex-col p-4 md:max-w-[420px] pointer-events-none outline-none",
  title: "text-sm font-semibold leading-none tracking-tight",
  description: "text-xs text-muted-foreground leading-relaxed mt-1.5",
  action:
    "inline-flex h-8 shrink-0 items-center justify-center rounded-lg border border-border bg-transparent px-3 text-xs font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-2 focus:ring-ring disabled:pointer-events-none disabled:opacity-50",
  close:
    "absolute right-2 top-2 rounded-md p-1 text-muted-foreground/60 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100 cursor-pointer",
  iconContainer: "mt-0.5 shrink-0",
  statusIcons: {
    success: "text-success",
    destructive: "text-destructive",
    error: "text-destructive",
    warning: "text-amber-500 dark:text-amber-400",
    info: "text-chart-4",
    default: "text-primary",
  },
} as const;
