import { cn } from "@packages/utils";
import { WINDOW_HEADER_STYLES } from "./constants";
import type { WindowControlsProps } from "./types";

export function WindowControls({
  size = "md",
  className,
  ...props
}: WindowControlsProps) {
  const dotSize = WINDOW_HEADER_STYLES.controls.sizes[size];

  return (
    <div
      data-slot="window-controls"
      className={cn(WINDOW_HEADER_STYLES.controls.base, className)}
      {...props}
    >
      <span className={cn(dotSize, WINDOW_HEADER_STYLES.controls.red)} />
      <span className={cn(dotSize, WINDOW_HEADER_STYLES.controls.yellow)} />
      <span className={cn(dotSize, WINDOW_HEADER_STYLES.controls.green)} />
    </div>
  );
}
