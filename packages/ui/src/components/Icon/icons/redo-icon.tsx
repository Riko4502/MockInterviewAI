import * as React from "react"
import {cn} from "@lib/utils"
import {iconVariants} from "../constants"
import type {IconProps} from "../types"

export function RedoIcon({size, className, ...props}: IconProps) {
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
      className={cn(iconVariants({size, className}))}
      {...props}
    >
      <path d="m15 14 5-5-5-5" />
  <path d="M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13" />
    </svg>
  )
}
