import { cn } from "@packages/utils";
import { STATUS_CONFIG } from "./constants";
import type { StatusIconProps } from "./types";

export function StatusIcon({ status, className }: StatusIconProps) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return null;
  }

  const { Icon, className: statusClassName } = config;
  return (
    <div
      className={cn(
        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
        statusClassName,
        className,
      )}
    >
      <Icon className="size-3.5" />
    </div>
  );
}
