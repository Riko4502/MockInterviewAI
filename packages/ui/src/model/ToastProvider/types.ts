import type * as React from "react";

export type ToastStatus =
  | "default"
  | "success"
  | "destructive"
  | "error"
  | "warning"
  | "info";

export interface ToastActionItem {
  label: React.ReactNode;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  altText?: string;
}

export interface ToastPushOptions {
  id?: string;
  status?: ToastStatus;
  title: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
  showCloseButton?: boolean;
  action?: ToastActionItem | React.ReactNode;
  onClose?: () => void;
}

export interface ToastData extends Required<Pick<ToastPushOptions, "id">> {
  status: ToastStatus;
  title: React.ReactNode;
  description?: React.ReactNode;
  duration?: number;
  showCloseButton?: boolean;
  action?: ToastActionItem | React.ReactNode;
  open: boolean;
  onClose?: () => void;
}

export interface ToastController {
  push: (options: ToastPushOptions) => string;
  dismiss: (id?: string) => void;
  allDismiss: () => void;
}
