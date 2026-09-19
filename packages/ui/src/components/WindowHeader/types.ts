import type * as React from "react";

export type WindowControlsSize = "sm" | "md" | "lg";

export interface WindowControlsProps
  extends React.HTMLAttributes<HTMLDivElement> {
  size?: WindowControlsSize;
}

export interface WindowHeaderProps
  extends React.HTMLAttributes<HTMLDivElement> {
  /** Left window controls (defaults to macOS traffic lights) */
  controls?: React.ReactNode;
  /** Actions or status indicators displayed on the right side */
  actions?: React.ReactNode;
  /** Main title, active tab, or custom center content */
  children?: React.ReactNode;
}
