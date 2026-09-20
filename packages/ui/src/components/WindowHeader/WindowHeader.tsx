import { cn } from "@packages/utils";
import { WINDOW_HEADER_STYLES } from "./constants";
import type { WindowHeaderProps } from "./types";
import { WindowControls } from "./WindowControls";

function WindowHeaderRoot({
  controls = <WindowControls />,
  actions,
  children,
  className,
  ...props
}: WindowHeaderProps) {
  return (
    <div
      data-slot="window-header"
      className={cn(WINDOW_HEADER_STYLES.root, className)}
      {...props}
    >
      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
        {controls}
        {children}
      </div>
      {actions && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}

export const WindowHeader = Object.assign(WindowHeaderRoot, {
  Controls: WindowControls,
});
