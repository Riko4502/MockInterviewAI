export const COMBOBOX_STYLES = {
  trigger:
    "flex h-8 w-full cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap outline-none transition-colors hover:bg-muted/50 select-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  triggerPlaceholder: "text-muted-foreground",
  triggerValue: "line-clamp-1 text-left",
  icon: "size-4 opacity-70",
  content:
    "relative z-50 w-(--radix-popover-trigger-width) min-w-56 origin-(--radix-popover-content-transform-origin) overflow-hidden rounded-lg border border-border bg-popover text-popover-foreground shadow-md outline-none data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
  searchWrapper:
    "flex items-center gap-2 border-b border-border px-3 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
  searchInput:
    "h-9 border-0 bg-transparent px-0 py-0 text-sm shadow-none focus-visible:border-transparent focus-visible:ring-0 dark:bg-transparent",
  listbox: "max-h-72 overflow-y-auto p-1",
  groupLabel: "px-2 py-1.5 text-xs font-medium text-muted-foreground",
  option:
    "flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none select-none data-[active=true]:bg-accent data-[active=true]:text-accent-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  optionCheck: "ml-auto shrink-0",
  empty: "px-3 py-6 text-center text-sm text-muted-foreground",
} as const;
