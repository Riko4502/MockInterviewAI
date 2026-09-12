export const RESIZABLE_STYLES = {
  group:
    "flex size-full data-[orientation=vertical]:flex-col data-[group-orientation=vertical]:flex-col",
  handle:
    "relative flex w-px items-center justify-center bg-border transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[separator-orientation=vertical]:h-px data-[separator-orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0 [&[data-orientation=vertical]>div]:rotate-90 [&[data-separator-orientation=vertical]>div]:rotate-90 hover:bg-ring/50 data-[drag-state=drag]:bg-ring cursor-col-resize data-[orientation=vertical]:cursor-row-resize data-[separator-orientation=vertical]:cursor-row-resize",
  grip: "z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-border bg-card text-muted-foreground shadow-xs pointer-events-none",
  gripDots: "size-2.5 shrink-0",
} as const;
