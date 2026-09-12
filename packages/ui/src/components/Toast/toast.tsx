"use client";

import { CloseIcon } from "@packages/icons";
import { cn } from "@packages/utils";
import { Toast as ToastPrimitive } from "radix-ui";
import { TOAST_STYLES, toastVariants } from "./constants";
import type {
  ToastActionProps,
  ToastCloseProps,
  ToastDescriptionProps,
  ToastProps,
  ToastProviderProps,
  ToastTitleProps,
  ToastViewportProps,
} from "./types";

/**
 * Провайдер примитивов Radix Toast.
 */
function ToastRadixProvider(props: ToastProviderProps) {
  return <ToastPrimitive.Provider {...props} />;
}

/**
 * Область отображения тостов на экране (Viewport).
 */
function ToastViewport({ className, ...props }: ToastViewportProps) {
  return (
    <ToastPrimitive.Viewport
      data-slot="toast-viewport"
      className={cn(TOAST_STYLES.viewport, className)}
      {...props}
    />
  );
}

/**
 * Отдельное уведомление (Toast).
 */
function ToastRoot({
  className,
  status = "default",
  showCloseButton = true,
  children,
  ...props
}: ToastProps) {
  return (
    <ToastPrimitive.Root
      data-slot="toast"
      data-status={status}
      className={cn(toastVariants({ status }), className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <ToastPrimitive.Close
          data-slot="toast-close"
          className={TOAST_STYLES.close}
          aria-label="Закрыть уведомление"
        >
          <CloseIcon className="size-4" />
        </ToastPrimitive.Close>
      )}
    </ToastPrimitive.Root>
  );
}

/**
 * Кнопка действия внутри тоста.
 */
function ToastAction({ className, ...props }: ToastActionProps) {
  return (
    <ToastPrimitive.Action
      data-slot="toast-action"
      className={cn(TOAST_STYLES.action, className)}
      {...props}
    />
  );
}

/**
 * Кнопка закрытия тоста.
 */
function ToastClose({ className, ...props }: ToastCloseProps) {
  return (
    <ToastPrimitive.Close
      data-slot="toast-close"
      className={cn(TOAST_STYLES.close, className)}
      {...props}
    />
  );
}

/**
 * Заголовок тоста.
 */
function ToastTitle({ className, ...props }: ToastTitleProps) {
  return (
    <ToastPrimitive.Title
      data-slot="toast-title"
      className={cn(TOAST_STYLES.title, className)}
      {...props}
    />
  );
}

/**
 * Описание тоста.
 */
function ToastDescription({ className, ...props }: ToastDescriptionProps) {
  return (
    <ToastPrimitive.Description
      data-slot="toast-description"
      className={cn(TOAST_STYLES.description, className)}
      {...props}
    />
  );
}

export const Toast = Object.assign(ToastRoot, {
  Provider: ToastRadixProvider,
  Viewport: ToastViewport,
  Title: ToastTitle,
  Description: ToastDescription,
  Action: ToastAction,
  Close: ToastClose,
});
