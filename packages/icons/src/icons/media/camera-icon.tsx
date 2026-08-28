import { cn } from "@packages/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function CameraIcon({ size, className, ...props }: IconProps) {
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
        d="M0 3C0 2.17266 0.672656 1.5 1.5 1.5H7.5C8.32734 1.5 9 2.17266 9 3V9C9 9.82734 8.32734 10.5 7.5 10.5H1.5C0.672656 10.5 0 9.82734 0 9V3ZM13.1039 2.33906C13.3477 2.47031 13.5 2.72344 13.5 3V9C13.5 9.27656 13.3477 9.52969 13.1039 9.66094C12.8578 9.79219 12.5648 9.77813 12.3328 9.62344L10.0828 8.12344L9.75 7.90078V7.5V4.5V4.09922L10.0828 3.87656L12.3328 2.37656C12.5625 2.22422 12.8578 2.20781 13.1039 2.33906Z"
        fill="currentColor"
      />
    </svg>
  );
}
