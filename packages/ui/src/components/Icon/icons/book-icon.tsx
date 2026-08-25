import * as React from "react"
import {cn} from "@lib/utils"
import {iconVariants} from "../constants"
import type {IconProps} from "../types"

export function BookIcon({size, className, ...props}: IconProps) {
  return (
    <svg
      viewBox="0 0 13 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({size, className}))}
      {...props}
    >
      <path
        d="M0 2.625C0 1.17578 1.17578 0 2.625 0H5.25V5.21445C5.25 5.58086 5.67383 5.78594 5.96094 5.55625L7.4375 4.375L8.91406 5.55625C9.20117 5.78594 9.625 5.58086 9.625 5.21445V0H10.5H11.375C11.859 0 12.25 0.391016 12.25 0.875V9.625C12.25 10.109 11.859 10.5 11.375 10.5V12.25C11.859 12.25 12.25 12.641 12.25 13.125C12.25 13.609 11.859 14 11.375 14H10.5H2.625C1.17578 14 0 12.8242 0 11.375V2.625ZM1.75 11.375C1.75 11.859 2.14102 12.25 2.625 12.25H9.625V10.5H2.625C2.14102 10.5 1.75 10.891 1.75 11.375Z"
        fill="currentColor"
      />
    </svg>
  )
}
