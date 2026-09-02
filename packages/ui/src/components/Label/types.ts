import type { VariantProps } from "@packages/utils";
import type * as LabelPrimitive from "@radix-ui/react-label";
import type * as React from "react";
import type { labelVariants } from "./constants";

export type LabelVariant = NonNullable<
  VariantProps<typeof labelVariants>["variant"]
>;
export type LabelSize = NonNullable<VariantProps<typeof labelVariants>["size"]>;

/**
 * Свойства компонента Label (текстовой метки формы).
 */
export interface LabelProps
  extends React.ComponentProps<typeof LabelPrimitive.Root>,
    VariantProps<typeof labelVariants> {
  /**
   * Отображать ли индикатор обязательного поля (*).
   * @default false
   */
  required?: boolean;
}
