import { cn } from "@packages/utils";
import { skeletonVariants } from "./constants";
import type { SkeletonProps } from "./types";

/**
 * Компонент-заглушка для отображения состояния загрузки контента (skeleton loading).
 * Размер по-прежнему задаётся снаружи через `className` (например, `h-4 w-32`),
 * а базовая форма — через проп `shape` (`rectangular`, `circle`, `text`).
 */
function Skeleton({ className, shape, ...props }: SkeletonProps) {
  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ shape }), className)}
      {...props}
    />
  );
}

export { Skeleton };
