import type { ButtonProps } from "@components/Button";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";
import type { buttonGroupVariants } from "./constants";

export type ButtonGroupOrientation = NonNullable<
  VariantProps<typeof buttonGroupVariants>["orientation"]
>;

/**
 * Значение контекста группы кнопок, передаваемое дочерним кнопкам.
 */
export interface ButtonGroupContextValue {
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  disabled?: boolean;
}

/**
 * Свойства компонента группы кнопок (ButtonGroup).
 */
export interface ButtonGroupProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof buttonGroupVariants> {
  /**
   * Склеивать ли кнопки между собой с бесшовными границами.
   * @default true
   */
  attached?: boolean;
  /**
   * Общий размер для всех кнопок внутри группы.
   */
  size?: ButtonProps["size"];
  /**
   * Общий цветовой вариант для всех кнопок внутри группы.
   */
  variant?: ButtonProps["variant"];
  /**
   * Отключить ли все кнопки внутри группы.
   */
  disabled?: boolean;
}
