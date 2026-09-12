export const RESIZABLE_STYLES = {
  group: "flex size-full data-[orientation=vertical]:flex-col",
  handle:
    "relative flex w-px items-center justify-center bg-border transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[orientation=vertical]:h-px data-[orientation=vertical]:w-full data-[orientation=vertical]:after:left-0 data-[orientation=vertical]:after:h-3 data-[orientation=vertical]:after:w-full data-[orientation=vertical]:after:-translate-y-1/2 data-[orientation=vertical]:after:translate-x-0 [&[data-orientation=vertical]>div]:rotate-90 hover:bg-ring/50 data-[separator=hover]:bg-ring/50 data-[separator=active]:bg-ring cursor-col-resize data-[orientation=vertical]:cursor-row-resize data-[separator=disabled]:pointer-events-none data-[separator=disabled]:opacity-50 data-[separator=disabled]:cursor-not-allowed",
  grip: "z-10 flex h-4 w-3 items-center justify-center rounded-xs border border-border bg-card text-muted-foreground shadow-xs pointer-events-none",
  gripDots: "size-2.5 shrink-0",
} as const;
