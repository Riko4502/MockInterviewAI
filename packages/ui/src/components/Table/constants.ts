export const TABLE_STYLES = {
  container:
    "relative w-full overflow-x-auto " +
    "[&::-webkit-scrollbar]:h-1.5 " +
    "[&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:rounded-full " +
    "[&::-webkit-scrollbar-thumb]:bg-border " +
    "hover:[&::-webkit-scrollbar-thumb]:bg-muted-foreground/50",
  root: "w-full caption-bottom text-sm",
  header: "[&_tr]:border-b [&_tr]:border-border",
  body: "[&_tr:last-child]:border-0",
  footer:
    "border-t border-border bg-muted/50 font-medium [&>tr]:last:border-b-0",
  row: "border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
  head: "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap [&:has([role=checkbox])]:pr-0",
  cell: "p-4 align-middle text-foreground whitespace-nowrap [&:has([role=checkbox])]:pr-0",
  caption: "mt-4 text-sm text-muted-foreground",
} as const;
