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
  /**
   * aria-label кнопки «показать пароль» (`type="password"`).
   * @default "Show password"
   */
  showPasswordLabel?: string;
  /**
   * aria-label кнопки «скрыть пароль» (`type="password"`).
   * @default "Hide password"
   */
  hidePasswordLabel?: string;
}
