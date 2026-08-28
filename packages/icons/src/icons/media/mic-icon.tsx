import { cn } from "@lib/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function MicIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 9 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M4.5 0C3.25781 0 2.25 1.00781 2.25 2.25V6C2.25 7.24219 3.25781 8.25 4.5 8.25C5.74219 8.25 6.75 7.24219 6.75 6V2.25C6.75 1.00781 5.74219 0 4.5 0ZM1.5 5.0625C1.5 4.75078 1.24922 4.5 0.9375 4.5C0.62578 4.5 0.375 4.75078 0.375 5.0625V6C0.375 8.08828 1.92656 9.81328 3.9375 10.0875V10.875H2.8125C2.50078 10.875 2.25 11.1258 2.25 11.4375C2.25 11.7492 2.50078 12 2.8125 12H4.5H6.1875C6.49922 12 6.75 11.7492 6.75 11.4375C6.75 11.1258 6.49922 10.875 6.1875 10.875H5.0625V10.0875C7.07344 9.81328 8.625 8.08828 8.625 6V5.0625C8.625 4.75078 8.37422 4.5 8.0625 4.5C7.75078 4.5 7.5 4.75078 7.5 5.0625V6C7.5 7.65703 6.15703 9 4.5 9C2.84297 9 1.5 7.65703 1.5 6V5.0625Z"
        fill="currentColor"
      />
    </svg>
  );
}
