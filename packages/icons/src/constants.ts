import { cva } from "class-variance-authority";

export const iconVariants = cva(
  "inline-block shrink-0 align-middle select-none",
  {
    variants: {
      size: {
        xs: "size-3",
        sm: "size-4",
        md: "size-5",
        lg: "size-6",
        xl: "size-8",
      },
    },
    defaultVariants: {
      size: "md",
    },
  },
);
