import { cva } from "@packages/utils";

export const badgeVariants = cva("inline-flex items-center justify-center", {
  variants: {
    variant: {
      tag: "rounded border border-border bg-card text-foreground",

      statusSuccess:
        "rounded-full border border-chart-3/20 bg-chart-3/10 text-chart-3",
      statusInfo:
        "rounded-full border border-chart-4/20 bg-chart-4/10 text-chart-4",
      statusDanger:
        "rounded-full border border-chart-5/20 bg-chart-5/10 text-chart-5",

      confirmed: "rounded border-0 bg-chart-3/10 text-chart-3",

      ready:
        "rounded border border-chart-3/20 bg-chart-3/10 text-chart-3 font-bold",
      waiting:
        "rounded border border-border bg-muted/20 text-muted-foreground font-bold",
    },
    size: {
      default: "px-3 py-1 text-xs",
    },
  },
  defaultVariants: {
    variant: "tag",
    size: "default",
  },
});
