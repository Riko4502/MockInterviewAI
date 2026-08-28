import { cn } from "@packages/utils";
import { iconVariants } from "../../constants";
import type { IconProps } from "../../types";

export function GoogleIcon({ size, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-slot="icon"
      className={cn(iconVariants({ size, className }))}
      {...props}
    >
      <path
        d="M17.1581 9.20391C17.1581 14.1785 13.7514 17.7188 8.72058 17.7188C3.89714 17.7188 0.00183105 13.8234 0.00183105 9C0.00183105 4.17656 3.89714 0.28125 8.72058 0.28125C11.069 0.28125 13.0448 1.14258 14.5671 2.56289L12.194 4.84453C9.08972 1.84922 3.31707 4.09922 3.31707 9C3.31707 12.041 5.74636 14.5055 8.72058 14.5055C12.1729 14.5055 13.4667 12.0305 13.6706 10.7473H8.72058V7.74844H17.021C17.1018 8.19492 17.1581 8.62383 17.1581 9.20391Z"
        fill="currentColor"
      />
    </svg>
  );
}
