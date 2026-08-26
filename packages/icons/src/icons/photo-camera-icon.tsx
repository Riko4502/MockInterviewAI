import * as React from "react";
import { cn } from "@lib/utils";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function PhotoCameraIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M4.65938 1.025L4.33437 2H2C0.896875 2 0 2.89687 0 4V12C0 13.1031 0.896875 14 2 14H14C15.1031 14 16 13.1031 16 12V4C16 2.89687 15.1031 2 14 2H11.6656L11.3406 1.025C11.1375 0.4125 10.5656 0 9.91875 0H6.08125C5.43438 0 4.8625 0.4125 4.65938 1.025ZM8 5C9.65574 5 11 6.34425 11 8C11 9.65574 9.65574 11 8 11C6.34425 11 5 9.65574 5 8C5 6.34425 6.34425 5 8 5Z"
        fill="currentColor"
      />
    </svg>
  );
}
