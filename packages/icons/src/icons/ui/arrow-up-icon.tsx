import { cn } from "@lib/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function ArrowUpIcon({ size, className, ...props }: IconProps) {
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
        d="M4.55859 2.05859C4.80273 1.81445 5.19922 1.81445 5.44336 2.05859L9.19336 5.80859C9.4375 6.05273 9.4375 6.44922 9.19336 6.69336C8.94922 6.9375 8.55273 6.9375 8.30859 6.69336L5 3.38477L1.69141 6.69141C1.44727 6.93555 1.05078 6.93555 0.806641 6.69141C0.5625 6.44727 0.5625 6.05078 0.806641 5.80664L4.55664 2.05664L4.55859 2.05859Z"
        fill="currentColor"
      />
    </svg>
  );
}
