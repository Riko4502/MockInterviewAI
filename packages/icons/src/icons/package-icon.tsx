import * as React from "react";
import { cn } from "@lib/utils";
import { iconVariants } from "../constants";
import type { IconProps } from "../types";

export function PackageIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 10 10"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn("text-[#60A5FA]", iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M4.58008 0.0732422C4.85156 -0.0244141 5.14844 -0.0244141 5.42188 0.0732422L9.17188 1.41309C9.66797 1.59082 10 2.06152 10 2.59082V7.33301C10 7.86035 9.66797 8.33301 9.16992 8.51074L5.41992 9.85059C5.14844 9.94824 4.85156 9.94824 4.57812 9.85059L0.828125 8.51074C0.332031 8.33301 0 7.8623 0 7.33301V2.59082C0 2.06348 0.332031 1.59082 0.830078 1.41309L4.58008 0.0732422ZM5 1.25098L1.60742 2.46191L5 3.67285L8.39258 2.46191L5 1.25098ZM5.625 8.4502L8.75 7.33496V3.66309L5.625 4.77832V8.4502Z"
        fill="currentColor"
      />
    </svg>
  );
}
