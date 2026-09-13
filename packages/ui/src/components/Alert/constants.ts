import { cva } from "@packages/utils";

export const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm grid has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] grid-cols-[0_1fr] has-[>svg]:gap-x-3 gap-y-0.5 items-start [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground border-border",
        destructive:
          "text-destructive bg-destructive/10 border-destructive/20 [&>svg]:text-destructive",
        warning:
          "text-chart-4 bg-chart-4/10 border-chart-4/20 [&>svg]:text-chart-4",
        info: "text-chart-1 bg-chart-1/10 border-chart-1/20 [&>svg]:text-chart-1",
        success:
          "text-chart-3 bg-chart-3/10 border-chart-3/20 [&>svg]:text-chart-3",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export const ALERT_STYLES = {
  title: "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
  description:
    "col-start-2 grid justify-items-start gap-1 text-muted-foreground text-sm [&_p]:leading-relaxed",
} as const;
