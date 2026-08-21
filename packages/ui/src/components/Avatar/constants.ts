import {cva} from "class-variance-authority"

export const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden rounded-full border border-border bg-secondary text-muted-foreground",
  {
    variants: {
      size: {
        sm: "size-6 text-sm",
        md: "size-8 text-base",
        lg: "size-14 text-lg",
      },
    },
    defaultVariants: {
      size: "md"
    }
  }
)