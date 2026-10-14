import type { VariantProps } from "@packages/utils";
import type { Select as SelectPrimitive } from "radix-ui";
import type * as React from "react";
import type {
  selectContentVariants,
  selectItemVariants,
  selectTriggerVariants,
} from "./constants";

export type SelectVariant = "default" | "primary" | "secondary";

export interface SelectContextValue {
  variant: SelectVariant;
}

/**
 * Вариант выбора для Select.
 */
export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export type SelectProps = React.ComponentProps<typeof SelectPrimitive.Root> & {
  variant?: SelectVariant;
  /**
   * Опциональный список вариантов выбора.
   * Если передан, Select автоматически рендерит Trigger, Value с placeholder и Content со списком Item.
   */
  options?: readonly SelectOption[];
  /**
   * Плейсхолдер для значения в триггере при использовании пропса `options`.
   */
  placeholder?: string;
  /**
   * Дополнительный класс для триггера при использовании пропса `options`.
   */
  triggerClassName?: string;
  /**
   * Размер триггера ('sm' | 'default').
   */
  triggerSize?: "sm" | "default";
  /**
   * Дополнительные свойства для триггера при использовании `options`.
   */
  triggerProps?: Partial<SelectTriggerProps>;
  /**
   * Дополнительные свойства для выпадающего списка (Content).
   */
  contentProps?: Partial<SelectContentProps>;
};

export type SelectGroupProps = React.ComponentProps<
  typeof SelectPrimitive.Group
>;

export type SelectValueProps = React.ComponentProps<
  typeof SelectPrimitive.Value
>;

export type SelectTriggerProps = React.ComponentProps<
  typeof SelectPrimitive.Trigger
> &
  VariantProps<typeof selectTriggerVariants>;

export type SelectContentProps = React.ComponentProps<
  typeof SelectPrimitive.Content
> &
  VariantProps<typeof selectContentVariants>;

export type SelectLabelProps = React.ComponentProps<
  typeof SelectPrimitive.Label
>;

export type SelectItemProps = React.ComponentProps<
  typeof SelectPrimitive.Item
> &
  VariantProps<typeof selectItemVariants>;

export type SelectSeparatorProps = React.ComponentProps<
  typeof SelectPrimitive.Separator
>;

export type SelectScrollUpButtonProps = React.ComponentProps<
  typeof SelectPrimitive.ScrollUpButton
>;

export type SelectScrollDownButtonProps = React.ComponentProps<
  typeof SelectPrimitive.ScrollDownButton
>;
