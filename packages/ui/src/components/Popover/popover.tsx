"use client";

import { CloseIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Popover as PopoverPrimitive } from "radix-ui";
import { POPOVER_STYLES } from "./constants";
import type {
  PopoverAnchorProps,
  PopoverArrowProps,
  PopoverCloseProps,
  PopoverContentProps,
  PopoverPortalProps,
  PopoverProps,
  PopoverTriggerProps,
} from "./types";

/**
 * Всплывающая панель (Popover).
 *
 * Составной API: `Popover` (корень) + `Popover.Trigger` + `Popover.Content` + `Popover.Anchor` + `Popover.Close` + `Popover.Arrow`.
 * Построен на базе Radix UI Popover с поддержкой позиционирования, фокуса, стрелки и анимаций.
 */
function PopoverRoot({ ...props }: PopoverProps) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger({ ...props }: PopoverTriggerProps) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverAnchor({ ...props }: PopoverAnchorProps) {
  return <PopoverPrimitive.Anchor data-slot="popover-anchor" {...props} />;
}

function PopoverClose({ ...props }: PopoverCloseProps) {
  return <PopoverPrimitive.Close data-slot="popover-close" {...props} />;
}

function PopoverPortal({ ...props }: PopoverPortalProps) {
  return <PopoverPrimitive.Portal data-slot="popover-portal" {...props} />;
}

function PopoverArrow({ className, ...props }: PopoverArrowProps) {
  return (
    <PopoverPrimitive.Arrow
      data-slot="popover-arrow"
      className={cn(POPOVER_STYLES.arrow, className)}
      {...props}
    />
  );
}

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  showCloseButton = false,
  children,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPortal>
      <PopoverPrimitive.Content
        data-slot="popover-content"
        align={align}
        sideOffset={sideOffset}
        className={cn(POPOVER_STYLES.content, className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <PopoverPrimitive.Close
            data-slot="popover-close"
            className={POPOVER_STYLES.closeButton}
            aria-label="Закрыть"
          >
            <CloseIcon size="xs" />
          </PopoverPrimitive.Close>
        )}
      </PopoverPrimitive.Content>
    </PopoverPortal>
  );
}

export const Popover = Object.assign(PopoverRoot, {
  Trigger: PopoverTrigger,
  Content: PopoverContent,
  Anchor: PopoverAnchor,
  Portal: PopoverPortal,
  Close: PopoverClose,
  Arrow: PopoverArrow,
});
