import { cn } from "@lib/utils";
import * as React from "react";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function ClockIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M6 0C9.31149 0 12 2.68851 12 6C12 9.31149 9.31149 12 6 12C2.68851 12 0 9.31149 0 6C0 2.68851 2.68851 0 6 0ZM5.4375 2.8125V6C5.4375 6.1875 5.53125 6.36328 5.68828 6.46875L7.93828 7.96875C8.19609 8.14219 8.54531 8.07188 8.71875 7.81172C8.89219 7.55156 8.82188 7.20469 8.56172 7.03125L6.5625 5.7V2.8125C6.5625 2.50078 6.31172 2.25 6 2.25C5.68828 2.25 5.4375 2.50078 5.4375 2.8125Z"
        fill="currentColor"
      />
    </svg>
  );
}
