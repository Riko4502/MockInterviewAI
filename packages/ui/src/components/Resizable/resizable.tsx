"use client";

import { cn } from "@packages/utils";
import type * as React from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import { RESIZABLE_STYLES } from "./constants";
import type {
  ResizableHandleProps,
  ResizablePanelGroupProps,
  ResizablePanelProps,
} from "./types";

/**
 * Иконка точек для визуальной плашки захвата (Grip).
 */
function GripVerticalIcon({
  className,
  ...props
}: React.ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      {...props}
    >
      <circle cx="9" cy="12" r="1" />
      <circle cx="9" cy="5" r="1" />
      <circle cx="9" cy="19" r="1" />
      <circle cx="15" cy="12" r="1" />
      <circle cx="15" cy="5" r="1" />
      <circle cx="15" cy="19" r="1" />
    </svg>
  );
}

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
    <Group
      data-slot="resizable-panel-group"
      orientation={resolvedOrientation}
      className={cn(RESIZABLE_STYLES.group, className)}
      {...props}
    />
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
  return (
    <Separator
      data-slot="resizable-handle"
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
