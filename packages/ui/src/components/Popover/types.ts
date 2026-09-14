import type { Popover as PopoverPrimitive } from "radix-ui";
import type { ComponentProps } from "react";

/**
 * Свойства корневого контейнера Popover.
 */
export type PopoverProps = ComponentProps<typeof PopoverPrimitive.Root>;

/**
 * Свойства элемента-триггера Popover.
 */
export type PopoverTriggerProps = ComponentProps<
  typeof PopoverPrimitive.Trigger
>;

/**
 * Свойства портала Popover.
 */
export type PopoverPortalProps = ComponentProps<typeof PopoverPrimitive.Portal>;

/**
 * Свойства якоря позиционирования Popover.
 */
export type PopoverAnchorProps = ComponentProps<typeof PopoverPrimitive.Anchor>;

/**
 * Свойства кнопки закрытия Popover.
 */
export type PopoverCloseProps = ComponentProps<typeof PopoverPrimitive.Close>;

/**
 * Свойства стрелки-указателя Popover.
 */
export type PopoverArrowProps = ComponentProps<typeof PopoverPrimitive.Arrow>;

/**
 * Свойства содержимого всплывающего окна Popover.
 */
export interface PopoverContentProps
  extends ComponentProps<typeof PopoverPrimitive.Content> {
  /**
   * Отображать ли встроенную кнопку-крестик закрытия.
   */
  showCloseButton?: boolean;
}
