"use client";

import { Button } from "@components/Button";
import { CloseIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Dialog as SheetPrimitive } from "radix-ui";
import { SHEET_STYLES } from "./constants";
import type {
  SheetCloseProps,
  SheetContentProps,
  SheetDescriptionProps,
  SheetFooterProps,
  SheetHeaderProps,
  SheetOverlayProps,
  SheetPortalProps,
  SheetProps,
  SheetTitleProps,
  SheetTriggerProps,
} from "./types";

/** Корневой контейнер выезжающей панели (Sheet.Root). */
function SheetRoot(props: SheetProps) {
  return <SheetPrimitive.Root data-slot="sheet" {...props} />;
}

/** Элемент, по клику на который открывается панель. */
function SheetTrigger(props: SheetTriggerProps) {
  return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

/** Кнопка закрытия панели. */
function SheetClose(props: SheetCloseProps) {
  return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

/** Портал — выносит содержимое панели в конец `<body>`. */
function SheetPortal(props: SheetPortalProps) {
  return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

/** Затемнение фона за панелью. */
function SheetOverlay({ className, ...props }: SheetOverlayProps) {
  return (
    <SheetPrimitive.Overlay
      data-slot="sheet-overlay"
      className={cn(SHEET_STYLES.overlay, className)}
      {...props}
    />
  );
}

/** Содержимое выезжающей панели. */
function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  ...props
}: SheetContentProps) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <SheetPrimitive.Content
        data-slot="sheet-content"
        data-side={side}
        className={cn(SHEET_STYLES.content, className)}
        {...props}
      >
        {children}
        {showCloseButton ? (
          <SheetPrimitive.Close data-slot="sheet-close" asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              className={SHEET_STYLES.close}
            >
              <CloseIcon />
              <span className="sr-only">Закрыть</span>
            </Button>
          </SheetPrimitive.Close>
        ) : null}
      </SheetPrimitive.Content>
    </SheetPortal>
  );
}

/** Шапка панели. */
function SheetHeader({ className, ...props }: SheetHeaderProps) {
  return (
    <div
      data-slot="sheet-header"
      className={cn(SHEET_STYLES.header, className)}
      {...props}
    />
  );
}

/** Подвал панели. */
function SheetFooter({ className, ...props }: SheetFooterProps) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(SHEET_STYLES.footer, className)}
      {...props}
    />
  );
}

/** Заголовок панели. */
function SheetTitle({ className, ...props }: SheetTitleProps) {
  return (
    <SheetPrimitive.Title
      data-slot="sheet-title"
      className={cn(SHEET_STYLES.title, className)}
      {...props}
    />
  );
}

/** Описание панели. */
function SheetDescription({ className, ...props }: SheetDescriptionProps) {
  return (
    <SheetPrimitive.Description
      data-slot="sheet-description"
      className={cn(SHEET_STYLES.description, className)}
      {...props}
    />
  );
}

/**
 * Выезжающая панель (Sheet) на базе диалога Radix.
 *
 * Используется как самостоятельный overlay и как мобильная версия Sidebar.
 */
export const Sheet = Object.assign(SheetRoot, {
  Trigger: SheetTrigger,
  Close: SheetClose,
  Portal: SheetPortal,
  Overlay: SheetOverlay,
  Content: SheetContent,
  Header: SheetHeader,
  Footer: SheetFooter,
  Title: SheetTitle,
  Description: SheetDescription,
});
