import { cn } from "@packages/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function Volume1Icon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <polygon
        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
        fill="currentColor"
        stroke="none"
      />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}
