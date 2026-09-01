"use client";

import { cn } from "@packages/utils";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { TOOLTIP_STYLES } from "./constants";
import type {
  TooltipArrowProps,
  TooltipContentProps,
  TooltipProps,
  TooltipProviderProps,
  TooltipRootProps,
  TooltipTriggerProps,
} from "./types";

/**
 * Провайдер всплывающих подсказок (Tooltip.Provider).
 */
function TooltipProvider({
  delayDuration = 200,
  ...props
}: TooltipProviderProps) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />;
}

/**
 * Корневой контейнер всплывающей подсказки (Tooltip.Root).
 */
function TooltipRoot(props: TooltipRootProps) {
  return <TooltipPrimitive.Root {...props} />;
}

/**
 * Триггер всплывающей подсказки (Tooltip.Trigger).
 */
function TooltipTrigger({ asChild = true, ...props }: TooltipTriggerProps) {
  return <TooltipPrimitive.Trigger asChild={asChild} {...props} />;
}

/**
 * Всплывающее окно с содержимым подсказки (Tooltip.Content).
 */
function TooltipContent({
  className,
  sideOffset = 4,
  children,
  ...props
}: TooltipContentProps) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(TOOLTIP_STYLES.content, className)}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  );
}

/**
 * Стрелка-указатель всплывающей подсказки (Tooltip.Arrow).
 */
function TooltipArrow({ className, ...props }: TooltipArrowProps) {
  return (
    <TooltipPrimitive.Arrow
      data-slot="tooltip-arrow"
      className={cn(TOOLTIP_STYLES.arrow, className)}
      {...props}
    />
  );
}

/**
 * Универсальный компонент всплывающей подсказки (Tooltip).
 *
 * Поддерживает:
 * - Краткий синтаксис: `<Tooltip content="Подсказка" side="top"><Button>Наведи</Button></Tooltip>`;
 * - Составной синтаксис: `<Tooltip.Root><Tooltip.Trigger><Button>...</Button></Tooltip.Trigger><Tooltip.Content>...</Tooltip.Content></Tooltip.Root>`.
 */
function TooltipMain({
  content,
  side = "top",
  align = "center",
  sideOffset = 4,
  delayDuration = 200,
  withArrow = false,
  children,
  ...props
}: TooltipProps) {
  if (content) {
    return (
      <TooltipProvider delayDuration={delayDuration}>
        <TooltipPrimitive.Root {...props}>
          <TooltipPrimitive.Trigger asChild>
            {children}
          </TooltipPrimitive.Trigger>
          <TooltipContent side={side} align={align} sideOffset={sideOffset}>
            {content}
            {withArrow && <TooltipArrow />}
          </TooltipContent>
        </TooltipPrimitive.Root>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider delayDuration={delayDuration}>
      <TooltipPrimitive.Root {...props}>{children}</TooltipPrimitive.Root>
    </TooltipProvider>
  );
}

export const Tooltip = Object.assign(TooltipMain, {
  Provider: TooltipProvider,
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
  Arrow: TooltipArrow,
});
