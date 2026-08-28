import { cn } from "@packages/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function CloseIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 8 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M6.69141 2.94141C6.93555 2.69727 6.93555 2.30078 6.69141 2.05664C6.44727 1.8125 6.05078 1.8125 5.80664 2.05664L3.75 4.11523L1.69141 2.05859C1.44727 1.81445 1.05078 1.81445 0.806641 2.05859C0.5625 2.30273 0.5625 2.69922 0.806641 2.94336L2.86523 5L0.808594 7.05859C0.564453 7.30273 0.564453 7.69922 0.808594 7.94336C1.05273 8.1875 1.44922 8.1875 1.69336 7.94336L3.75 5.88477L5.80859 7.94141C6.05273 8.18555 6.44922 8.18555 6.69336 7.94141C6.9375 7.69727 6.9375 7.30078 6.69336 7.05664L4.63477 5L6.69141 2.94141Z"
        fill="currentColor"
      />
    </svg>
  );
}
