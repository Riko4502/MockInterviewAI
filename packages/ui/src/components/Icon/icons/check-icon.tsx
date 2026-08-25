import * as React from "react"
import {cn} from "@lib/utils"
import {iconVariants} from "../constants"
import type {IconProps} from "../types"

export function CheckIcon({size, className, ...props}: IconProps) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}
