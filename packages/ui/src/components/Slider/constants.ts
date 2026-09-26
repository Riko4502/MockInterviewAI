/**
 * Стили для каждой части компонента Slider (shadcn/ui style).
 */
export const SLIDER_STYLES = {
  root: "relative flex w-full touch-none select-none items-center data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
  track:
    "relative grow overflow-hidden rounded-full bg-muted data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5",
  range:
    "absolute bg-primary data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full",
  thumb:
    "block size-4 shrink-0 rounded-full border border-primary/50 bg-background shadow-xs transition-colors hover:border-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
} as const;
