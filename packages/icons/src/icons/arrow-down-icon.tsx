import { cn } from "@lib/utils";
import * as React from "react";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function ArrowDownIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M4.55859 7.94141C4.80273 8.18555 5.19922 8.18555 5.44336 7.94141L9.19336 4.19141C9.4375 3.94727 9.4375 3.55078 9.19336 3.30664C8.94922 3.0625 8.55273 3.0625 8.30859 3.30664L5 6.61523L1.69141 3.30859C1.44727 3.06445 1.05078 3.06445 0.806641 3.30859C0.5625 3.55273 0.5625 3.94922 0.806641 4.19336L4.55664 7.94336L4.55859 7.94141Z"
        fill="currentColor"
      />
    </svg>
  );
}
