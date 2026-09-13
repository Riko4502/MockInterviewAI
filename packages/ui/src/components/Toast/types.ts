import type { VariantProps } from "@packages/utils";
import type { Toast as ToastPrimitive } from "radix-ui";
import type * as React from "react";
import type { toastVariants } from "./constants";

export type ToastProps = React.ComponentProps<typeof ToastPrimitive.Root> &
  VariantProps<typeof toastVariants> & {
    showCloseButton?: boolean;
  };

export type ToastActionProps = React.ComponentProps<
  typeof ToastPrimitive.Action
>;
export type ToastCloseProps = React.ComponentProps<typeof ToastPrimitive.Close>;
export type ToastTitleProps = React.ComponentProps<typeof ToastPrimitive.Title>;
export type ToastDescriptionProps = React.ComponentProps<
  typeof ToastPrimitive.Description
>;
export type ToastViewportProps = React.ComponentProps<
  typeof ToastPrimitive.Viewport
>;
export type ToastProviderProps = React.ComponentProps<
  typeof ToastPrimitive.Provider
>;
