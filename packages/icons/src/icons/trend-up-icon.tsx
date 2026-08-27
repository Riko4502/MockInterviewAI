import { cn } from "@lib/utils";
import * as React from "react";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function TrendUpIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 14 13"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M1.75 0.875C1.75 0.391016 1.35898 0 0.875 0C0.391016 0 0 0.391016 0 0.875V10.0625C0 11.2711 0.978906 12.25 2.1875 12.25H13.125C13.609 12.25 14 11.859 14 11.375C14 10.891 13.609 10.5 13.125 10.5H2.1875C1.94687 10.5 1.75 10.3031 1.75 10.0625V0.875ZM12.868 3.24297C13.2098 2.90117 13.2098 2.34609 12.868 2.0043C12.5262 1.6625 11.9711 1.6625 11.6293 2.0043L8.75 4.88633L7.18047 3.3168C6.83867 2.975 6.28359 2.975 5.9418 3.3168L2.8793 6.3793C2.5375 6.72109 2.5375 7.27617 2.8793 7.61797C3.22109 7.95977 3.77617 7.95977 4.11797 7.61797L6.5625 5.17617L8.13203 6.7457C8.47383 7.0875 9.02891 7.0875 9.3707 6.7457L12.8707 3.2457L12.868 3.24297Z"
        fill="currentColor"
      />
    </svg>
  );
}
