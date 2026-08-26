import { cva } from "class-variance-authority"

export const selectTriggerVariants = cva(
  "cursor-pointer flex w-fit items-center justify-between gap-1.5 rounded-lg border py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-input bg-transparent hover:bg-muted/50 dark:bg-input/30 dark:hover:bg-input/50",
        primary:
          "border-transparent bg-primary text-background hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
      },
      size: {
        default: "h-8",
        sm: "h-7 rounded-[min(var(--radius-md),10px)]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export const selectContentVariants = cva(
  "relative z-50 max-h-(--radix-select-content-available-height) min-w-36 origin-(--radix-select-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-lg shadow-md duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
  {
    variants: {
      variant: {
        default:
          "border border-border bg-popover text-popover-foreground ring-1 ring-foreground/10",
        primary:
          "border border-primary/20 bg-primary text-background",
        secondary:
          "border border-secondary/20 bg-secondary text-secondary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export const selectItemVariants = cva(
  "relative flex w-full cursor-pointer items-center gap-1.5 rounded-md py-1.5 pr-8 pl-1.5 text-sm outline-hidden select-none transition-colors data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
  {
    variants: {
      variant: {
        default: "focus:bg-accent focus:text-accent-foreground",
        primary: "focus:bg-background/20 focus:text-background",
        secondary:
          "focus:bg-secondary-foreground/15 focus:text-secondary-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
