"use client";

import { cn } from "@packages/utils";
import * as LabelPrimitive from "@radix-ui/react-label";
import { labelVariants } from "./constants";
import type { LabelProps } from "./types";

/**
 * Компонент текстовой метки формы (Label).
 *
 * Построен на базе Radix UI Label с поддержкой:
 * - Различных размеров (`sm`, `default`, `lg`);
 * - Цветовых вариантов (`default`, `muted`, `destructive`, `success`);
 * - Маркера обязательного поля (`required`);
 * - Интеграции с состоянием отключенного инпута (`peer-disabled`).
 */
function Label({
  className,
  variant = "default",
  size = "default",
  required = false,
  ...props
}: LabelProps) {
  return (
    <LabelPrimitive.Root
      data-slot="label"
      className={cn(labelVariants({ variant, size, required, className }))}
      {...props}
    />
  );
}

export { Label };
