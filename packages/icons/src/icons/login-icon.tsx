import { cn } from "@lib/utils";
import * as React from "react";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function LoginIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M8.51172 2.88672L13.3086 7.68359C13.5898 7.96484 13.75 8.35156 13.75 8.75C13.75 9.14844 13.5898 9.53516 13.3086 9.81641L8.51172 14.6133C8.26172 14.8633 7.92578 15 7.57422 15C6.84375 15 6.25 14.4062 6.25 13.6758V11.25H1.25C0.558594 11.25 0 10.6914 0 10V7.5C0 6.80859 0.558594 6.25 1.25 6.25H6.25V3.82422C6.25 3.09375 6.84375 2.5 7.57422 2.5C7.92578 2.5 8.26172 2.64062 8.51172 2.88672ZM13.75 15H16.25C16.9414 15 17.5 14.4414 17.5 13.75V3.75C17.5 3.05859 16.9414 2.5 16.25 2.5H13.75C13.0586 2.5 12.5 1.94141 12.5 1.25C12.5 0.558594 13.0586 0 13.75 0H16.25C18.3203 0 20 1.67969 20 3.75V13.75C20 15.8203 18.3203 17.5 16.25 17.5H13.75C13.0586 17.5 12.5 16.9414 12.5 16.25C12.5 15.6914 13.0586 15 13.75 15Z"
        fill="currentColor"
      />
    </svg>
  );
}
