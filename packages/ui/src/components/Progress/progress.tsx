"use client";

import { cn } from "@packages/utils";
import { Progress as ProgressPrimitive } from "radix-ui";
import * as React from "react";
import { PROGRESS_STYLES } from "./constants";
import type {
  ProgressContextValue,
  ProgressLabelProps,
  ProgressProps,
  ProgressValueProps,
} from "./types";

const ProgressContext = React.createContext<ProgressContextValue>({
  max: 100,
  percentage: 0,
});

/**
 * Компонент индикатора прогресса (Progress).
 *
 * Простое использование:
 * ```tsx
 * <Progress value={40} aria-label="Прогресс" />
 * ```
 *
 * Составное использование с подписью и процентами (подпись автоматически
 * связывается с баром через aria-labelledby):
 * ```tsx
 * <Progress value={56}>
 *   <Progress.Label>Upload progress</Progress.Label>
 *   <Progress.Value />
 * </Progress>
 * ```
 */
function ProgressRoot({
  className,
  value,
  max = 100,
  children,
  ...props
}: ProgressProps) {
  const generatedId = React.useId();
  const labelId = children ? `${generatedId}-progress-label` : undefined;
  const percentage =
    value != null ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;

  return (
    <ProgressContext.Provider value={{ value, max, percentage, labelId }}>
      <div
        data-slot="progress-wrapper"
        className={cn(PROGRESS_STYLES.wrapper, className)}
      >
        {children && (
          <div data-slot="progress-header" className={PROGRESS_STYLES.header}>
            {children}
          </div>
        )}
        <ProgressPrimitive.Root
          data-slot="progress"
          value={value}
          max={max}
          aria-labelledby={labelId}
          className={PROGRESS_STYLES.track}
          {...props}
        >
          <ProgressPrimitive.Indicator
            data-slot="progress-indicator"
            className={PROGRESS_STYLES.indicator}
            style={{ transform: `translateX(-${100 - percentage}%)` }}
          />
        </ProgressPrimitive.Root>
      </div>
    </ProgressContext.Provider>
  );
}

/**
 * Текстовая подпись прогресса (например, "Upload progress").
 */
function ProgressLabel({ className, ...props }: ProgressLabelProps) {
  const { labelId } = React.useContext(ProgressContext);
  return (
    <span
      id={labelId}
      data-slot="progress-label"
      className={cn(PROGRESS_STYLES.label, className)}
      {...props}
    />
  );
}

/**
 * Числовое значение прогресса в процентах — вычисляется автоматически из `value`/`max` корня.
 */
function ProgressValue({ className, ...props }: ProgressValueProps) {
  const { percentage } = React.useContext(ProgressContext);
  return (
    <span
      data-slot="progress-value"
      className={cn(PROGRESS_STYLES.value, className)}
      {...props}
    >
      {Math.round(percentage)}%
    </span>
  );
}

export const Progress = Object.assign(ProgressRoot, {
  Label: ProgressLabel,
  Value: ProgressValue,
});
