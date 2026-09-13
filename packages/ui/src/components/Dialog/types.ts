import type { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";

export type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>;
export type DialogTriggerProps = React.ComponentProps<
  typeof DialogPrimitive.Trigger
>;
export type DialogPortalProps = React.ComponentProps<
  typeof DialogPrimitive.Portal
>;
export type DialogCloseProps = React.ComponentProps<
  typeof DialogPrimitive.Close
>;
export type DialogOverlayProps = React.ComponentProps<
  typeof DialogPrimitive.Overlay
>;

/**
 * Свойства содержимого диалога (Dialog.Content).
 */
export interface DialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  /**
   * Показывать ли кнопку закрытия (крестик) в правом верхнем углу.
   * @default true
   */
  showCloseButton?: boolean;
}

export type DialogHeaderProps = React.ComponentProps<"div">;

/**
 * Свойства футера диалога (Dialog.Footer).
 */
export interface DialogFooterProps extends React.ComponentProps<"div"> {
  /**
   * Показывать ли кнопку "Закрыть" в футере автоматически.
   * @default false
   */
  showCloseButton?: boolean;
}

export type DialogTitleProps = React.ComponentProps<
  typeof DialogPrimitive.Title
>;
export type DialogDescriptionProps = React.ComponentProps<
  typeof DialogPrimitive.Description
>;
