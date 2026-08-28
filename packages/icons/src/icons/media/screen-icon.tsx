import { cn } from "@packages/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function ScreenIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 14 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M1.5 0C0.672656 0 0 0.672656 0 1.5V8.25C0 9.07734 0.672656 9.75 1.5 9.75H5.625L5.37422 10.5H3.75C3.33516 10.5 3 10.8352 3 11.25C3 11.6648 3.33516 12 3.75 12H9.75C10.1648 12 10.5 11.6648 10.5 11.25C10.5 10.8352 10.1648 10.5 9.75 10.5H8.12578L7.875 9.75H12C12.8273 9.75 13.5 9.07734 13.5 8.25V1.5C13.5 0.672656 12.8273 0 12 0H1.5ZM12 1.5V8.25H1.5V1.5H12Z"
        fill="currentColor"
      />
    </svg>
  );
}
