import { cva } from "@packages/utils";

export const skeletonVariants = cva("animate-pulse bg-accent", {
  variants: {
    shape: {
      rectangular: "rounded-md",
      circle: "rounded-full",
      text: "h-4 w-full rounded-md",
    },
  },
  defaultVariants: {
    shape: "rectangular",
  },
});
