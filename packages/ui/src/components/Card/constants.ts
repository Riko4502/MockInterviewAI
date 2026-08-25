export const CARD_STYLES = {
  root: "group/card flex flex-col gap-2 p-6 overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10 *:[img:first-child]:rounded-t-xl *:[img:last-child]:rounded-b-xl",
  header: "group/card-header @container/card-header grid auto-rows-min items-start gap-1 rounded-t-xl has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto]",
  title: "text-base leading-snug font-bold",
  description: "text-sm text-muted-foreground font-bold",
  action: "col-start-2 row-span-2 row-start-1 self-start justify-self-end text-primary",
  content: "text-[14px] font-medium",
  footer: "flex items-center text-muted-foreground",
} as const