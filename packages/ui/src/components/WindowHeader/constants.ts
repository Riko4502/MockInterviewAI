export const WINDOW_HEADER_STYLES = {
  root: "flex items-center justify-between px-2.5 sm:px-3.5 py-2 sm:py-2.5 border-b border-black/[0.06] dark:border-white/[0.08] bg-black/[0.02] dark:bg-white/[0.02] rounded-t-[22px] gap-1.5 sm:gap-2",
  controls: {
    base: "flex items-center gap-1 sm:gap-1.5 shrink-0",
    sizes: {
      sm: "w-2 h-2",
      md: "w-2 sm:w-2.5 h-2 sm:h-2.5",
      lg: "w-3 h-3",
    },
    red: "rounded-full bg-[#ff5f56]/90 shadow-sm border border-[#e0443e]/20",
    yellow: "rounded-full bg-[#ffbd2e]/90 shadow-sm border border-[#dea123]/20",
    green: "rounded-full bg-[#27c93f]/90 shadow-sm border border-[#1aab29]/20",
  },
} as const;
