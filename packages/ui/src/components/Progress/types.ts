import type { Progress as ProgressPrimitive } from "radix-ui";
import type * as React from "react";

/**
 * Значение контекста Progress, доступное дочерним Progress.Label / Progress.Value.
 */
export interface ProgressContextValue {
  value?: number | null;
  max: number;
  percentage: number;
  labelId?: string;
}

export type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root>;
export type ProgressLabelProps = React.ComponentProps<"span">;
export type ProgressValueProps = React.ComponentProps<"span">;
