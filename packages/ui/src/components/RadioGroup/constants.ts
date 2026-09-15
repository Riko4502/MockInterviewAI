export const RADIO_GROUP_STYLES = {
  root: "grid gap-3",
  item: "aspect-square size-4 shrink-0 rounded-full border border-input shadow-xs transition-shadow outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:border-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 text-primary data-[state=checked]:border-primary",
  indicator:
    "flex items-center justify-center after:content-[''] after:block after:size-2 after:rounded-full after:bg-primary",
} as const;
