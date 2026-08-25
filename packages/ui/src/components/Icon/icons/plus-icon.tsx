import * as React from "react"
import {cn} from "@lib/utils"
import {iconVariants} from "../constants"
import type {IconProps} from "../types"

export function PlusIcon({size, className, ...props}: IconProps) {
  return (
    <svg
      viewBox="0 0 17 17"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({size, className}))}
      {...props}
    >
      <path
        d="M9.375 1.25C9.375 0.558594 8.81641 0 8.125 0C7.43359 0 6.875 0.558594 6.875 1.25V6.875H1.25C0.558594 6.875 0 7.43359 0 8.125C0 8.81641 0.558594 9.375 1.25 9.375H6.875V15C6.875 15.6914 7.43359 16.25 8.125 16.25C8.81641 16.25 9.375 15.6914 9.375 15V9.375H15C15.6914 9.375 16.25 8.81641 16.25 8.125C16.25 7.43359 15.6914 6.875 15 6.875H9.375V1.25Z"
        fill="currentColor"
      />
    </svg>
  )
}
