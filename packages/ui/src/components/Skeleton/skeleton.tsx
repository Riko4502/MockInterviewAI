import { cn } from "@packages/utils";
import { SKELETON_STYLES } from "./constants";
import type { SkeletonProps } from "./types";

/**
 * Компонент-заглушка для отображения состояния загрузки контента (skeleton loading).
 * Форма и размер задаются снаружи через `className` (например, `h-4 w-32` для строки текста
 * или `size-10 rounded-full` для аватарки).
 */
function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(SKELETON_STYLES, className)}
      {...props}
    />
  );
}

export { Skeleton };
