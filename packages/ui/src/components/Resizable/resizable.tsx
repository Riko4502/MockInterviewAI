"use client";

import { GripVerticalIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { createContext, useContext } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { RESIZABLE_STYLES } from "./constants";
import type {
  ResizableHandleProps,
  ResizablePanelGroupProps,
  ResizablePanelProps,
} from "./types";

interface ResizableGroupContextValue {
  orientation: "horizontal" | "vertical";
}

const ResizableGroupContext = createContext<ResizableGroupContextValue>({
  orientation: "horizontal",
});

/**
 * Контейнер группы панелей (ResizablePanelGroup).
 */
function ResizablePanelGroup({
  className,
  orientation,
  direction,
  ...props
}: ResizablePanelGroupProps) {
  const resolvedOrientation = orientation ?? direction ?? "horizontal";

  return (
    <ResizableGroupContext.Provider
      value={{ orientation: resolvedOrientation }}
    >
      <Group
        data-slot="resizable-panel-group"
        data-orientation={resolvedOrientation}
        orientation={resolvedOrientation}
        className={cn(RESIZABLE_STYLES.group, className)}
        {...props}
      />
    </ResizableGroupContext.Provider>
  );
}

/**
 * Отдельная масштабируемая панель (ResizablePanel).
 */
function ResizablePanel({ className, ...props }: ResizablePanelProps) {
  return (
    <Panel data-slot="resizable-panel" className={cn(className)} {...props} />
  );
}

/**
 * Разделитель с возможностью перетаскивания (ResizableHandle).
 */
function ResizableHandle({
  withHandle,
  className,
  ...props
}: ResizableHandleProps) {
  const { orientation } = useContext(ResizableGroupContext);

  return (
    <Separator
      data-slot="resizable-handle"
      data-orientation={orientation}
      className={cn(RESIZABLE_STYLES.handle, className)}
      {...props}
    >
      {withHandle && (
        <div
          data-slot="resizable-handle-grip"
          className={RESIZABLE_STYLES.grip}
        >
          <GripVerticalIcon className={RESIZABLE_STYLES.gripDots} />
        </div>
      )}
    </Separator>
  );
}

export const Resizable = Object.assign(ResizablePanelGroup, {
  Group: ResizablePanelGroup,
  Panel: ResizablePanel,
  Handle: ResizableHandle,
});

export { ResizableHandle, ResizablePanel, ResizablePanelGroup };
