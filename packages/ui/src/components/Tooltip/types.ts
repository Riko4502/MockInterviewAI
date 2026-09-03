import type { Tooltip as TooltipPrimitive } from "radix-ui";
import type * as React from "react";

/**
 * Свойства провайдера всплывающих подсказок (Tooltip.Provider).
 */
export type TooltipProviderProps = React.ComponentProps<
  typeof TooltipPrimitive.Provider
>;

/**
 * Свойства корневого контейнера подсказки (Tooltip.Root).
 */
export type TooltipRootProps = React.ComponentProps<
  typeof TooltipPrimitive.Root
>;

/**
 * Свойства триггера всплывающей подсказки (Tooltip.Trigger).
 */
export type TooltipTriggerProps = React.ComponentProps<
  typeof TooltipPrimitive.Trigger
>;

/**
 * Свойства всплывающего окна подсказки (Tooltip.Content).
 */
export type TooltipContentProps = React.ComponentProps<
  typeof TooltipPrimitive.Content
>;

/**
 * Свойства стрелки всплывающей подсказки (Tooltip.Arrow).
 */
export type TooltipArrowProps = React.ComponentProps<
  typeof TooltipPrimitive.Arrow
>;

/**
 * Свойства универсального компонента Tooltip (поддерживает и shorthand, и составное использование).
 */
export interface TooltipProps extends TooltipRootProps {
  /**
   * Текст или содержимое всплывающей подсказки (shorthand-режим).
   */
  content?: React.ReactNode;
  /**
   * Сторона появления подсказки относительно триггера.
   * @default "top"
   */
  side?: TooltipContentProps["side"];
  /**
   * Выравнивание подсказки по оси триггера.
   * @default "center"
   */
  align?: TooltipContentProps["align"];
  /**
   * Смещение от триггера в пикселях.
   * @default 4
   */
  sideOffset?: number;
  /**
   * Задержка появления подсказки в миллисекундах.
   * @default 200
   */
  delayDuration?: number;
  /**
   * Отображать ли стрелку-указатель.
   * @default false
   */
  withArrow?: boolean;
}
