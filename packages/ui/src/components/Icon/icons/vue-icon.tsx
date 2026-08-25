import * as React from "react"
import {cn} from "@lib/utils"
import {iconVariants} from "../constants"
import type {IconProps} from "../types"

export function VueIcon({size, className, ...props}: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn("text-[#4FC08D]", iconVariants({size, className}))}
      {...props}
    >
      <path
        d="M24,1.61H14.06L12,5.16,9.94,1.61H0L12,22.39ZM12,14.08,5.16,2.23H9.59L12,6.41l2.41-4.18h4.43Z"
        fill="currentColor"
      />
    </svg>
  )
}
