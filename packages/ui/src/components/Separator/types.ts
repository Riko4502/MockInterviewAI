import type { VariantProps } from "class-variance-authority";
import type { Separator as SeparatorPrimitive } from "radix-ui";
import type * as React from "react";
import type { separatorVariants } from "./constants";

export type SeparatorOrientation = NonNullable<
  VariantProps<typeof separatorVariants>["orientation"]
>;
export type SeparatorVariant = NonNullable<
  VariantProps<typeof separatorVariants>["variant"]
>;

/**
 * Свойства компонента визуального разделителя (Separator).
 */
export interface SeparatorProps
  extends Omit<
      React.ComponentProps<typeof SeparatorPrimitive.Root>,
      "orientation"
    >,
    VariantProps<typeof separatorVariants> {
  /**
   * Текстовая подпись по центру горизонтального разделителя (например, "ИЛИ").
   */
  label?: React.ReactNode;
}
