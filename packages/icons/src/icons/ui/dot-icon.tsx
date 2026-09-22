import { cn } from "@packages/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function DotIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      data-slot="icon"
      className={cn("shrink-0", iconVariants({ size, className }))}
      {...props}
    >
      <circle cx="12" cy="12" r="5" fill="currentColor" />
    </svg>
  );
}

export function CircleDotIcon({ size, className, ...props }: IconProps) {
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
      className={cn("shrink-0", iconVariants({ size, className }))}
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="4" fill="currentColor" stroke="none" />
    </svg>
  );
}
