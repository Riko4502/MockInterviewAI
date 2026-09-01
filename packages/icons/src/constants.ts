import { cva } from "@packages/utils";

export const ICON_SIZE_MAP = {
  xs: "size-3",
  sm: "size-4",
  md: "size-5",
  lg: "size-6",
  xl: "size-8",
} as const;

export const iconVariants = cva(
  "inline-block shrink-0 align-middle select-none",
  {
    variants: {
      size: ICON_SIZE_MAP,
    },
    defaultVariants: {
      size: "md",
    },
  },
);
