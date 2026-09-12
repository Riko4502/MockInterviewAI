"use client";

import { Button } from "@components/Button";
import { CloseIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Dialog as DialogPrimitive } from "radix-ui";
import { DIALOG_STYLES } from "./constants";
import type {
  DialogCloseProps,
  DialogContentProps,
  DialogDescriptionProps,
  DialogFooterProps,
  DialogHeaderProps,
  DialogOverlayProps,
  DialogPortalProps,
  DialogProps,
  DialogTitleProps,
  DialogTriggerProps,
} from "./types";

/**
 * Компонент модального окна (Dialog).
 *
 * Составной API: `Dialog` (корень) + `Dialog.Trigger` + `Dialog.Content`
 * (внутри `Content` — опционально `Dialog.Header`, `Dialog.Footer`, `Dialog.Title`, `Dialog.Description`).
 *
 * Построен на базе Radix UI Dialog: фокус-ловушка, закрытие по `Esc` и клику на overlay
 * обеспечиваются самим примитивом.
 */
function DialogRoot({ ...props }: DialogProps) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogTriggerProps) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPortalProps) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogCloseProps) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({ className, ...props }: DialogOverlayProps) {
  return (
    <DialogPrimitive.Overlay
      data-slot="dialog-overlay"
      className={cn(DIALOG_STYLES.overlay, className)}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DialogContentProps) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="dialog-content"
        className={cn(DIALOG_STYLES.content, className)}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close data-slot="dialog-close" asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={DIALOG_STYLES.closeButton}
            >
              <CloseIcon />
              <span className="sr-only">Закрыть</span>
            </Button>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: DialogHeaderProps) {
  return (
    <div
      data-slot="dialog-header"
      className={cn(DIALOG_STYLES.header, className)}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: DialogFooterProps) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(DIALOG_STYLES.footer, className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close asChild>
          <Button variant="outline">Закрыть</Button>
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogTitleProps) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(DIALOG_STYLES.title, className)}
      {...props}
    />
  );
}

function DialogDescription({ className, ...props }: DialogDescriptionProps) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(DIALOG_STYLES.description, className)}
      {...props}
    />
  );
}

export const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Portal: DialogPortal,
  Overlay: DialogOverlay,
  Content: DialogContent,
  Header: DialogHeader,
  Footer: DialogFooter,
  Title: DialogTitle,
  Description: DialogDescription,
  Close: DialogClose,
});
