import type { VariantProps } from "@packages/utils";
import type * as React from "react";
import type { inputVariants } from "./constants";

/**
 * Свойства компонента текстового поля ввода (Input).
 */
export interface InputProps
  extends React.ComponentProps<"input">,
    VariantProps<typeof inputVariants> {
  /**
   * Отображать ли кастомные стрелки регулирования (stepper) для числового поля (`type="number"`).
   * @default true
   */
  showStepper?: boolean;
}
