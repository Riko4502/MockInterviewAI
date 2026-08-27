import * as React from "react";
import { cn } from "@lib/utils";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function KotlinIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn("text-[#7F52FF]", iconVariants({ size, className }))}
      {...props}
    >
      <path d="M24 24H0V0h24L12 12Z" fill="currentColor" />
    </svg>
  );
}
