/**
 * Токены стилей для компонента InputGroup.
 */
export const INPUT_GROUP_STYLES = {
  root: "group/input-group relative flex w-full items-center has-[>[data-slot=input-prefix]]:[&>[data-slot=input]]:pl-10 has-[>[data-slot=input-suffix]]:[&>[data-slot=input]]:pr-10",
  attached:
    "[&>[data-slot=input]]:first:rounded-l-lg [&>[data-slot=input]]:last:rounded-r-lg [&>[data-slot=input]:not(:first-child)]:rounded-l-none [&>[data-slot=input]:not(:last-child)]:rounded-r-none [&>[data-slot=input]:not(:first-child)]:-ml-px [&>[data-slot=button]]:h-[46px] [&>[data-slot=button]]:px-4 [&>[data-slot=button]]:first:rounded-l-lg [&>[data-slot=button]]:last:rounded-r-lg [&>[data-slot=button]:not(:first-child)]:rounded-l-none [&>[data-slot=button]:not(:last-child)]:rounded-r-none [&>[data-slot=button]:not(:first-child)]:-ml-px [&>[data-slot=button]:hover]:z-10 [&>[data-slot=button]:focus-visible]:z-20 [&>[data-slot=input]:focus-visible]:z-20",
  prefix:
    "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground select-none z-10 [&_svg]:!size-4 [&_svg]:!w-4 [&_svg]:!h-4 [&_[data-slot=icon]]:!size-4",
  suffix:
    "absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center justify-center text-muted-foreground select-none z-10 [&_svg]:!size-4 [&_svg]:!w-4 [&_svg]:!h-4 [&_[data-slot=icon]]:!size-4",
  addon:
    "inline-flex h-[46px] items-center px-3.5 border border-input bg-muted/40 text-muted-foreground text-sm font-medium whitespace-nowrap select-none first:rounded-l-lg first:border-r-0 last:rounded-r-lg last:border-l-0 not-first:not-last:border-x-0",
} as const;
