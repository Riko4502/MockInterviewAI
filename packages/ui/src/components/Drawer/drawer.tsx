"use client";

import { Button } from "@components/Button";
import { DrawerContext } from "@model/DrawerProvider";
import { CloseIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Dialog as DrawerPrimitive } from "radix-ui";
import { useContext } from "react";
import { DRAWER_STYLES, drawerContentVariants } from "./constants";
import type {
  DrawerCloseProps,
  DrawerContentProps,
  DrawerDescriptionProps,
  DrawerFooterProps,
  DrawerHandleProps,
  DrawerHeaderProps,
  DrawerOverlayProps,
  DrawerPortalProps,
  DrawerProps,
  DrawerTitleProps,
  DrawerTriggerProps,
} from "./types";

/**
 * Корневой контейнер шторки (Drawer).
 * Поддерживает как неконтролируемый/контролируемый режим, так и синхронизацию по `name` с `useDrawer`.
 */
function DrawerRoot({ name, open, onOpenChange, ...props }: DrawerProps) {
  const drawer = useContext(DrawerContext);

  const resolvedOpen =
    open !== undefined
      ? open
      : name && drawer
        ? drawer.isOpen(name)
        : undefined;

  const resolvedOnOpenChange =
    onOpenChange !== undefined
      ? onOpenChange
      : name && drawer
        ? (nextOpen: boolean) => {
            if (nextOpen) {
              drawer.open(name);
            } else {
              drawer.close(name);
            }
          }
        : undefined;

  return (
    <DrawerPrimitive.Root
      data-slot="drawer"
      open={resolvedOpen}
      onOpenChange={resolvedOnOpenChange}
      {...props}
    />
  );
}

function DrawerTrigger(props: DrawerTriggerProps) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal(props: DrawerPortalProps) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose(props: DrawerCloseProps) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerOverlay({ className, ...props }: DrawerOverlayProps) {
  return (
    <DrawerPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(DRAWER_STYLES.overlay, className)}
      {...props}
    />
  );
}

function DrawerHandle({ className, ...props }: DrawerHandleProps) {
  return (
    <div
      data-slot="drawer-handle"
      className={cn(DRAWER_STYLES.handle, className)}
      aria-hidden="true"
      {...props}
    />
  );
}

function DrawerContent({
  className,
  children,
  side = "bottom",
  showHandle = side === "bottom" || side === "top",
  showCloseButton = true,
  ...props
}: DrawerContentProps) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        data-side={side}
        className={cn(drawerContentVariants({ side }), className)}
        {...props}
      >
        {showHandle && <DrawerHandle />}
        {children}
        {showCloseButton && (
          <DrawerPrimitive.Close data-slot="drawer-close" asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={DRAWER_STYLES.close}
            >
              <CloseIcon className="size-4" />
              <span className="sr-only">Закрыть</span>
            </Button>
          </DrawerPrimitive.Close>
        )}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerHeader({ className, ...props }: DrawerHeaderProps) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(DRAWER_STYLES.header, className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: DrawerFooterProps) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(DRAWER_STYLES.footer, className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: DrawerTitleProps) {
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      className={cn(DRAWER_STYLES.title, className)}
      {...props}
    />
  );
}

function DrawerDescription({ className, ...props }: DrawerDescriptionProps) {
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      className={cn(DRAWER_STYLES.description, className)}
      {...props}
    />
  );
}

export const Drawer = Object.assign(DrawerRoot, {
  Trigger: DrawerTrigger,
  Portal: DrawerPortal,
  Overlay: DrawerOverlay,
  Content: DrawerContent,
  Header: DrawerHeader,
  Footer: DrawerFooter,
  Title: DrawerTitle,
  Description: DrawerDescription,
  Close: DrawerClose,
  Handle: DrawerHandle,
});
