/**
 * Стили для каждой части компонента Progress.
 */
export const PROGRESS_STYLES = {
  wrapper: "flex w-full flex-col gap-1.5",
  header: "flex items-center justify-between text-sm",
  label: "text-muted-foreground",
  value: "font-medium tabular-nums text-foreground",
  track:
    "relative flex h-1 w-full items-center overflow-hidden rounded-full bg-muted",
  indicator: "size-full flex-1 bg-primary transition-all",
} as const;
