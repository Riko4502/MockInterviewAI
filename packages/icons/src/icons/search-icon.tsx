import { cn } from "@lib/utils";
import * as React from "react";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function SearchIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M16.25 8.125C16.25 9.91797 15.668 11.5742 14.6875 12.918L19.6328 17.8672C20.1211 18.3555 20.1211 19.1484 19.6328 19.6367C19.1445 20.125 18.3516 20.125 17.8633 19.6367L12.918 14.6875C11.5742 15.6719 9.91797 16.25 8.125 16.25C3.63672 16.25 0 12.6133 0 8.125C0 3.63672 3.63672 0 8.125 0C12.6133 0 16.25 3.63672 16.25 8.125ZM8.125 13.75C11.2295 13.75 13.75 11.2295 13.75 8.125C13.75 5.02048 11.2295 2.5 8.125 2.5C5.02048 2.5 2.5 5.02048 2.5 8.125C2.5 11.2295 5.02048 13.75 8.125 13.75Z"
        fill="currentColor"
      />
    </svg>
  );
}
