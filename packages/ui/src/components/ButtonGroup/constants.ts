import { cva } from "@packages/utils";

/**
 * Варианты оформления и компоновки группы кнопок ButtonGroup.
 */
export const buttonGroupVariants = cva("inline-flex select-none", {
  variants: {
    orientation: {
      horizontal:
        "flex-row items-center data-[attached=true]:[&>[data-slot=button]]:rounded-none data-[attached=true]:[&>[data-slot=button]:first-child]:rounded-l-md data-[attached=true]:[&>[data-slot=button]:last-child]:rounded-r-md data-[attached=true]:[&>[data-slot=button]:not(:first-child)]:-ml-px data-[attached=true]:[&>[data-slot=button]:hover]:z-10 data-[attached=true]:[&>[data-slot=button]:focus-visible]:z-20 data-[attached=false]:gap-2",
      vertical:
        "flex-col items-stretch data-[attached=true]:[&>[data-slot=button]]:rounded-none data-[attached=true]:[&>[data-slot=button]:first-child]:rounded-t-md data-[attached=true]:[&>[data-slot=button]:last-child]:rounded-b-md data-[attached=true]:[&>[data-slot=button]:not(:first-child)]:-mt-px data-[attached=true]:[&>[data-slot=button]:hover]:z-10 data-[attached=true]:[&>[data-slot=button]:focus-visible]:z-20 data-[attached=false]:gap-2 [&>[data-slot=button]]:w-full",
    },
  },
  defaultVariants: {
    orientation: "horizontal",
  },
});
