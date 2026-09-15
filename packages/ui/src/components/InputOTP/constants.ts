export const INPUT_OTP_STYLES = {
  root: "disabled:cursor-not-allowed",
  container: "flex items-center gap-2 has-disabled:opacity-50",
  group: "flex items-center",
  slot: "relative flex size-10 items-center justify-center border-y border-r border-input text-sm shadow-xs transition-all first:rounded-l-md first:border-l last:rounded-r-md data-[active=true]:z-10 data-[active=true]:border-ring data-[active=true]:ring-[3px] data-[active=true]:ring-ring/50 data-[invalid=true]:border-destructive data-[invalid=true]:ring-destructive/20 bg-card text-foreground font-mono font-semibold",
  caret:
    "pointer-events-none absolute inset-0 flex items-center justify-center",
  caretLine: "h-4 w-px animate-caret-blink bg-foreground duration-1000",
  separator:
    "text-muted-foreground flex items-center justify-center px-1 select-none",
} as const;
